import asyncio
import json
import re
import logging
import time
import hashlib
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union, AsyncGenerator, Callable
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import tiktoken

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.ai.context import FinancialContext, FinancialContextBuilder

logger = logging.getLogger(__name__)


class AIModel(str, Enum):
    GPT4_TURBO = "gpt-4o"
    GPT4O = "gpt-4o"
    GPT4O_MINI = "gpt-4o-mini"
    GPT4 = "gpt-4o"
    GPT35_TURBO = "gpt-3.5-turbo"
    GPT4_VISION = "gpt-4o"


class ResponseFormat(str, Enum):
    TEXT = "text"
    JSON = "json_object"
    MARKDOWN = "markdown"


@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost: float = 0.0
    
    def add(self, other: "TokenUsage") -> None:
        self.prompt_tokens += other.prompt_tokens
        self.completion_tokens += other.completion_tokens
        self.total_tokens += other.total_tokens
        self.estimated_cost += other.estimated_cost


@dataclass
class AIResponse:
    content: str
    success: bool = True
    
    model: str = ""
    tokens: TokenUsage = field(default_factory=TokenUsage)
    latency_ms: int = 0
    
    actions: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[Dict[str, Any]] = field(default_factory=list)
    entities: Dict[str, Any] = field(default_factory=dict)
    
    confidence: float = 1.0
    sources: List[Dict[str, Any]] = field(default_factory=list)
    follow_up_questions: List[str] = field(default_factory=list)
    
    agent_name: Optional[str] = None
    agent_type: Optional[str] = None
    
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    tool_results: List[Dict[str, Any]] = field(default_factory=list)
    
    raw_response: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    error_code: Optional[str] = None
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "success": self.success,
            "model": self.model,
            "tokens": {
                "prompt": self.tokens.prompt_tokens,
                "completion": self.tokens.completion_tokens,
                "total": self.tokens.total_tokens,
                "cost": self.tokens.estimated_cost,
            },
            "latency_ms": self.latency_ms,
            "actions": self.actions,
            "recommendations": self.recommendations,
            "insights": self.insights,
            "confidence": self.confidence,
            "agent": self.agent_name,
            "error": self.error,
        }


@dataclass
class Message:
    role: str
    content: str
    name: Optional[str] = None
    tool_calls: Optional[List[Dict]] = None
    tool_call_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        msg = {"role": self.role, "content": self.content}
        if self.name:
            msg["name"] = self.name
        if self.tool_calls:
            msg["tool_calls"] = self.tool_calls
        if self.tool_call_id:
            msg["tool_call_id"] = self.tool_call_id
        return msg


class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        parameters: Dict[str, Any],
        handler: Callable = None,
    ):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.handler = handler
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            }
        }
    
    async def execute(self, **kwargs) -> Any:
        if self.handler:
            if asyncio.iscoroutinefunction(self.handler):
                return await self.handler(**kwargs)
            return self.handler(**kwargs)
        return None


class RateLimiter:
    def __init__(
        self,
        requests_per_minute: int = 60,
        tokens_per_minute: int = 90000,
    ):
        self.rpm_limit = requests_per_minute
        self.tpm_limit = tokens_per_minute
        self.request_times: List[float] = []
        self.token_usage: List[Tuple[float, int]] = []
        self._lock = asyncio.Lock()
    
    async def acquire(self, estimated_tokens: int = 1000) -> None:
        async with self._lock:
            now = time.time()
            minute_ago = now - 60
            
            self.request_times = [t for t in self.request_times if t > minute_ago]
            self.token_usage = [(t, tokens) for t, tokens in self.token_usage if t > minute_ago]
            
            current_requests = len(self.request_times)
            current_tokens = sum(tokens for _, tokens in self.token_usage)
            
            if current_requests >= self.rpm_limit:
                sleep_time = self.request_times[0] - minute_ago
                if sleep_time > 0:
                    logger.warning(f"Rate limit: sleeping {sleep_time:.2f}s (requests)")
                    await asyncio.sleep(sleep_time)
            
            if current_tokens + estimated_tokens >= self.tpm_limit:
                sleep_time = self.token_usage[0][0] - minute_ago
                if sleep_time > 0:
                    logger.warning(f"Rate limit: sleeping {sleep_time:.2f}s (tokens)")
                    await asyncio.sleep(sleep_time)
            
            self.request_times.append(now)
    
    def record_usage(self, tokens: int) -> None:
        self.token_usage.append((time.time(), tokens))


class ResponseCache:
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl = ttl_seconds
        self._cache: Dict[str, Tuple[AIResponse, float]] = {}
        self._lock = asyncio.Lock()
    
    def _get_key(self, messages: List[Dict], model: str, **kwargs) -> str:
        key_data = json.dumps({"messages": messages, "model": model, **kwargs}, sort_keys=True)
        return hashlib.sha256(key_data.encode()).hexdigest()
    
    async def get(self, messages: List[Dict], model: str, **kwargs) -> Optional[AIResponse]:
        key = self._get_key(messages, model, **kwargs)
        async with self._lock:
            if key in self._cache:
                response, timestamp = self._cache[key]
                if time.time() - timestamp < self.ttl:
                    logger.debug(f"Cache hit for key {key[:8]}")
                    return response
                del self._cache[key]
        return None
    
    async def set(self, messages: List[Dict], model: str, response: AIResponse, **kwargs) -> None:
        key = self._get_key(messages, model, **kwargs)
        async with self._lock:
            if len(self._cache) >= self.max_size:
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
                del self._cache[oldest_key]
            self._cache[key] = (response, time.time())


class TokenCounter:
    _encoders: Dict[str, Any] = {}
    
    @classmethod
    def count(cls, text: str, model: str = "gpt-4") -> int:
        try:
            if model not in cls._encoders:
                try:
                    cls._encoders[model] = tiktoken.encoding_for_model(model)
                except KeyError:
                    cls._encoders[model] = tiktoken.get_encoding("cl100k_base")
            return len(cls._encoders[model].encode(text))
        except Exception:
            return len(text) // 4
    
    @classmethod
    def count_messages(cls, messages: List[Dict], model: str = "gpt-4") -> int:
        total = 0
        for msg in messages:
            total += 4
            for key, value in msg.items():
                if isinstance(value, str):
                    total += cls.count(value, model)
        total += 2
        return total
    
    @classmethod
    def estimate_cost(cls, prompt_tokens: int, completion_tokens: int, model: str) -> float:
        costs = {
            "gpt-4o": (0.005, 0.015),
            "gpt-4o-mini": (0.00015, 0.0006),
            "gpt-4": (0.03, 0.06),
            "gpt-3.5-turbo": (0.0005, 0.0015),
        }
        prompt_cost, completion_cost = costs.get(model, (0.01, 0.03))
        return (prompt_tokens / 1000 * prompt_cost) + (completion_tokens / 1000 * completion_cost)


class AIEngine:
    SYSTEM_PROMPT = """You are Nexora AI, an advanced autonomous financial advisor specializing in helping freelancers and self-employed professionals in Chicago, Illinois manage their finances.

Your capabilities include:
- Real-time financial analysis and insights
- Tax optimization for self-employed individuals (Schedule C, quarterly estimates)
- Cash flow forecasting and management
- Expense categorization and tracking
- Invoice management and payment predictions
- Business expense identification and documentation
- Proactive financial alerts and recommendations

Key principles:
1. Be specific and actionable - provide concrete numbers, dates, and steps
2. Consider tax implications for all financial decisions (Illinois 4.95% + Federal + 15.3% SE tax)
3. Account for income variability common to freelancers
4. Prioritize building tax reserves and emergency funds
5. Identify opportunities for legitimate tax deductions
6. Be proactive about upcoming deadlines and potential issues

Always base your advice on the user's actual financial data when provided. Be concise but thorough."""

    def __init__(self, db: Session = None):
        import os
        groq_key = os.environ.get("GROQ_API_KEY", "")
        openai_key = settings.openai.OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY", "")
        if groq_key and groq_key != "your_groq_api_key_here":
            # Use Groq free tier (OpenAI-compatible)
            self.client = AsyncOpenAI(
                api_key=groq_key,
                base_url="https://api.groq.com/openai/v1",
            )
            self._model_override = "llama-3.3-70b-versatile"
            logger.info("AI Engine using Groq (llama-3.3-70b-versatile)")
        else:
            self.client = AsyncOpenAI(api_key=openai_key)
            self._model_override = None
            logger.info("AI Engine using OpenAI")
        self.db = db
        self.rate_limiter = RateLimiter(
            requests_per_minute=settings.openai.OPENAI_RATE_LIMIT_RPM,
            tokens_per_minute=settings.openai.OPENAI_RATE_LIMIT_TPM,
        )
        self.cache = ResponseCache()
        self.tools: Dict[str, Tool] = {}
        self._context_builder: Optional[FinancialContextBuilder] = None
        self._register_default_tools()
    
    def _register_default_tools(self) -> None:
        self.register_tool(Tool(
            name="categorize_transaction",
            description="Categorize a transaction as business or personal expense with Schedule C category",
            parameters={
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string", "description": "Transaction ID to categorize"},
                    "category": {"type": "string", "description": "Category name"},
                    "schedule_c_category": {"type": "string", "description": "IRS Schedule C category"},
                    "is_business": {"type": "boolean", "description": "Whether this is a business expense"},
                    "business_percentage": {"type": "number", "description": "Percentage that is business use (0-100)"},
                    "confidence": {"type": "number", "description": "Confidence score 0-1"},
                },
                "required": ["transaction_id", "category", "is_business"],
            }
        ))
        
        self.register_tool(Tool(
            name="create_alert",
            description="Create a financial alert for the user",
            parameters={
                "type": "object",
                "properties": {
                    "alert_type": {"type": "string", "enum": ["tax_deadline", "low_balance", "invoice_overdue", "spending_spike", "opportunity"]},
                    "severity": {"type": "string", "enum": ["info", "warning", "urgent", "critical"]},
                    "title": {"type": "string"},
                    "message": {"type": "string"},
                    "action_required": {"type": "boolean"},
                },
                "required": ["alert_type", "severity", "title", "message"],
            }
        ))
        
        self.register_tool(Tool(
            name="calculate_tax_estimate",
            description="Calculate estimated tax liability",
            parameters={
                "type": "object",
                "properties": {
                    "gross_income": {"type": "number"},
                    "deductions": {"type": "number"},
                    "filing_status": {"type": "string", "enum": ["single", "married_filing_jointly", "married_filing_separately", "head_of_household"]},
                    "state": {"type": "string"},
                },
                "required": ["gross_income"],
            }
        ))
        
        self.register_tool(Tool(
            name="forecast_cash_flow",
            description="Generate cash flow forecast for specified months",
            parameters={
                "type": "object",
                "properties": {
                    "months": {"type": "integer", "description": "Number of months to forecast (1-12)"},
                    "include_scenarios": {"type": "boolean", "description": "Include optimistic/pessimistic scenarios"},
                },
                "required": ["months"],
            }
        ))
        
        self.register_tool(Tool(
            name="send_invoice_reminder",
            description="Queue an invoice reminder to be sent to client",
            parameters={
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string"},
                    "reminder_type": {"type": "string", "enum": ["friendly", "firm", "final"]},
                    "custom_message": {"type": "string"},
                },
                "required": ["invoice_id", "reminder_type"],
            }
        ))
        
        self.register_tool(Tool(
            name="set_goal",
            description="Create or update a financial goal",
            parameters={
                "type": "object",
                "properties": {
                    "goal_type": {"type": "string", "enum": ["savings", "emergency_fund", "tax_reserve", "debt_payoff", "income"]},
                    "target_amount": {"type": "number"},
                    "target_date": {"type": "string", "description": "Target date in YYYY-MM-DD format"},
                    "name": {"type": "string"},
                },
                "required": ["goal_type", "target_amount"],
            }
        ))
    
    def register_tool(self, tool: Tool) -> None:
        self.tools[tool.name] = tool
    
    @property
    def context_builder(self) -> FinancialContextBuilder:
        if self._context_builder is None and self.db:
            self._context_builder = FinancialContextBuilder(self.db)
        return self._context_builder
    
    async def chat(
        self,
        messages: List[Union[Dict, Message]],
        model: str = None,
        temperature: float = None,
        max_tokens: int = None,
        response_format: ResponseFormat = ResponseFormat.TEXT,
        tools: List[str] = None,
        use_cache: bool = True,
        context: FinancialContext = None,
        system_prompt: str = None,
    ) -> AIResponse:
        model = self._model_override or model or settings.openai.OPENAI_MODEL
        temperature = temperature if temperature is not None else settings.openai.OPENAI_TEMPERATURE
        max_tokens = max_tokens or settings.openai.OPENAI_MAX_TOKENS
        
        formatted_messages = []
        
        final_system = system_prompt or self.SYSTEM_PROMPT
        if context:
            final_system += f"\n\n{context.to_prompt()}"
        
        formatted_messages.append({"role": "system", "content": final_system})
        
        for msg in messages:
            if isinstance(msg, Message):
                formatted_messages.append(msg.to_dict())
            else:
                formatted_messages.append(msg)
        
        if use_cache:
            cached = await self.cache.get(formatted_messages, model, temperature=temperature)
            if cached:
                cached.metadata["from_cache"] = True
                return cached
        
        estimated_tokens = TokenCounter.count_messages(formatted_messages, model)
        await self.rate_limiter.acquire(estimated_tokens + max_tokens)
        
        start_time = time.time()
        
        try:
            kwargs = {
                "model": model,
                "messages": formatted_messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            
            if response_format == ResponseFormat.JSON:
                kwargs["response_format"] = {"type": "json_object"}
            
            tool_defs = None
            if tools:
                tool_defs = [self.tools[t].to_dict() for t in tools if t in self.tools]
                if tool_defs:
                    kwargs["tools"] = tool_defs
                    kwargs["tool_choice"] = "auto"
            
            response = await self.client.chat.completions.create(**kwargs)
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            message = response.choices[0].message
            content = message.content or ""
            
            tokens = TokenUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
                estimated_cost=TokenCounter.estimate_cost(
                    response.usage.prompt_tokens,
                    response.usage.completion_tokens,
                    model,
                ),
            )
            
            self.rate_limiter.record_usage(tokens.total_tokens)
            
            ai_response = AIResponse(
                content=content,
                success=True,
                model=model,
                tokens=tokens,
                latency_ms=latency_ms,
                raw_response=response.model_dump(),
            )
            
            if message.tool_calls:
                ai_response.tool_calls = [
                    {
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                    }
                    for tc in message.tool_calls
                ]
                
                for tc in ai_response.tool_calls:
                    ai_response.actions.append({
                        "action": tc["name"],
                        "params": tc["arguments"],
                        "executed": False,
                    })
            
            if response_format == ResponseFormat.JSON and content:
                try:
                    parsed = json.loads(content)
                    ai_response.recommendations = parsed.get("recommendations", [])
                    ai_response.insights = parsed.get("insights", [])
                    ai_response.entities = parsed.get("entities", {})
                    ai_response.follow_up_questions = parsed.get("follow_up_questions", [])
                    if "confidence" in parsed:
                        ai_response.confidence = parsed["confidence"]
                except json.JSONDecodeError:
                    pass
            
            if use_cache and not ai_response.tool_calls:
                await self.cache.set(formatted_messages, model, ai_response, temperature=temperature)
            
            return ai_response
            
        except Exception as e:
            logger.error(f"AI Engine error: {e}", exc_info=True)
            latency_ms = int((time.time() - start_time) * 1000)
            return AIResponse(
                content="I apologize, but I encountered an error processing your request. Please try again.",
                success=False,
                model=model,
                latency_ms=latency_ms,
                error=str(e),
                error_code=type(e).__name__,
            )
    
    async def chat_with_tools(
        self,
        messages: List[Union[Dict, Message]],
        tools: List[str],
        max_iterations: int = 5,
        context: FinancialContext = None,
        **kwargs,
    ) -> AIResponse:
        all_messages = list(messages)
        total_tokens = TokenUsage()
        all_actions = []
        all_tool_results = []
        
        for iteration in range(max_iterations):
            response = await self.chat(
                messages=all_messages,
                tools=tools,
                context=context,
                use_cache=False,
                **kwargs,
            )
            
            total_tokens.add(response.tokens)
            
            if not response.tool_calls:
                response.tokens = total_tokens
                response.actions = all_actions
                response.tool_results = all_tool_results
                return response
            
            all_messages.append({
                "role": "assistant",
                "content": response.content,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": json.dumps(tc["arguments"])}
                    }
                    for tc in response.tool_calls
                ],
            })
            
            for tc in response.tool_calls:
                tool = self.tools.get(tc["name"])
                if tool:
                    try:
                        result = await tool.execute(**tc["arguments"])
                        result_str = json.dumps(result) if result else "Action completed successfully"
                    except Exception as e:
                        logger.error(f"Tool execution error: {e}")
                        result_str = json.dumps({"error": str(e)})
                else:
                    result_str = json.dumps({"error": f"Unknown tool: {tc['name']}"})
                
                all_messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_str,
                })
                
                all_actions.append({
                    "action": tc["name"],
                    "params": tc["arguments"],
                    "executed": True,
                    "result": result_str,
                })
                all_tool_results.append({
                    "tool": tc["name"],
                    "result": result_str,
                })
        
        final_response = await self.chat(
            messages=all_messages,
            context=context,
            use_cache=False,
            **kwargs,
        )
        total_tokens.add(final_response.tokens)
        final_response.tokens = total_tokens
        final_response.actions = all_actions
        final_response.tool_results = all_tool_results
        
        return final_response
    
    async def stream(
        self,
        messages: List[Union[Dict, Message]],
        model: str = None,
        temperature: float = None,
        context: FinancialContext = None,
        system_prompt: str = None,
    ) -> AsyncGenerator[str, None]:
        model = self._model_override or model or settings.openai.OPENAI_MODEL
        temperature = temperature if temperature is not None else settings.openai.OPENAI_TEMPERATURE
        
        formatted_messages = []
        
        final_system = system_prompt or self.SYSTEM_PROMPT
        if context:
            final_system += f"\n\n{context.to_compact_prompt()}"
        
        formatted_messages.append({"role": "system", "content": final_system})
        
        for msg in messages:
            if isinstance(msg, Message):
                formatted_messages.append(msg.to_dict())
            else:
                formatted_messages.append(msg)
        
        estimated_tokens = TokenCounter.count_messages(formatted_messages, model)
        await self.rate_limiter.acquire(estimated_tokens + 2000)
        
        try:
            stream = await self.client.chat.completions.create(
                model=model,
                messages=formatted_messages,
                temperature=temperature,
                stream=True,
            )
            
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"\n\nError: {str(e)}"
    
    async def analyze_transaction(
        self,
        transaction: Dict[str, Any],
        context: FinancialContext = None,
    ) -> AIResponse:
        prompt = f"""Analyze this transaction and provide categorization:

Transaction:
- Merchant: {transaction.get('merchant_name', transaction.get('name', 'Unknown'))}
- Amount: ${abs(transaction.get('amount', 0)):,.2f}
- Date: {transaction.get('transaction_date', 'Unknown')}
- Description: {transaction.get('description', transaction.get('name', ''))}
- Current Category: {transaction.get('category', 'Uncategorized')}

Respond in JSON format:
{{
    "category": "string - category name",
    "schedule_c_category": "string or null - IRS Schedule C line if business (advertising, car_and_truck, commissions_and_fees, contract_labor, depreciation, insurance, interest, legal_and_professional, office_expense, rent, repairs_and_maintenance, supplies, taxes_and_licenses, travel, meals, utilities, wages, other)",
    "is_business_expense": boolean,
    "is_tax_deductible": boolean,
    "business_percentage": number 0-100,
    "confidence": number 0-1,
    "reasoning": "brief explanation",
    "similar_merchants": ["list of similar merchant name patterns for auto-categorization"]
}}"""

        return await self.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.2,
            context=context,
        )
    
    async def generate_insights(
        self,
        context: FinancialContext,
        focus_areas: List[str] = None,
    ) -> AIResponse:
        focus = ", ".join(focus_areas) if focus_areas else "all areas"
        
        prompt = f"""Based on the financial data provided, generate actionable insights focusing on: {focus}

Respond in JSON format:
{{
    "insights": [
        {{
            "type": "tax_saving|expense_reduction|income_opportunity|cash_flow_warning|spending_pattern",
            "priority": "low|medium|high|critical",
            "title": "Brief title",
            "summary": "1-2 sentence summary",
            "detailed_explanation": "Full explanation with specific numbers",
            "potential_impact": number (dollar amount),
            "confidence": number 0-1,
            "action_steps": ["Step 1", "Step 2"],
            "deadline": "YYYY-MM-DD or null",
            "evidence": ["Data point 1", "Data point 2"]
        }}
    ],
    "summary": "Overall financial summary in 2-3 sentences",
    "top_priority": "The single most important action to take"
}}

Generate 3-5 high-value insights based on the data."""

        return await self.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.4,
            context=context,
        )
    
    async def forecast_cash_flow(
        self,
        context: FinancialContext,
        months: int = 3,
        scenarios: bool = True,
    ) -> AIResponse:
        prompt = f"""Generate a {months}-month cash flow forecast based on the financial data.

Consider:
- Historical income patterns and variability ({context.income.income_variability.value})
- Recurring expenses and subscriptions
- Outstanding invoices (${context.invoices.total_outstanding:,.2f})
- Upcoming tax payments
- Seasonal patterns if evident

Respond in JSON format:
{{
    "forecasts": [
        {{
            "month": "YYYY-MM",
            "projected_income": number,
            "projected_income_range": [min, max],
            "projected_expenses": number,
            "projected_expenses_range": [min, max],
            "net_cash_flow": number,
            "ending_balance": number,
            "confidence": number 0-1,
            "key_factors": ["factor1", "factor2"]
        }}
    ],
    {"'scenarios': {'optimistic': {...}, 'pessimistic': {...}}," if scenarios else ""}
    "risk_factors": [
        {{"factor": "description", "probability": "low|medium|high", "impact": number, "mitigation": "suggestion"}}
    ],
    "recommendations": ["recommendation1", "recommendation2"],
    "runway_months": number,
    "cash_crunch_risk": boolean,
    "cash_crunch_date": "YYYY-MM-DD or null"
}}"""

        return await self.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.3,
            context=context,
        )
    
    async def what_if_analysis(
        self,
        context: FinancialContext,
        scenario: Dict[str, Any],
    ) -> AIResponse:
        prompt = f"""Perform a what-if analysis for this scenario:

Scenario: {json.dumps(scenario, indent=2)}

Analyze the impact on:
1. Cash flow (monthly and annual)
2. Tax liability (federal, state, self-employment)
3. Runway and financial health
4. Business expenses and deductions

Respond in JSON format:
{{
    "scenario_summary": "Brief description of the scenario",
    "financial_impact": {{
        "income_change": number,
        "expense_change": number,
        "net_annual_impact": number,
        "tax_impact": {{
            "federal_change": number,
            "state_change": number,
            "se_tax_change": number,
            "total_tax_change": number
        }},
        "net_after_tax_impact": number
    }},
    "cash_flow_impact": {{
        "monthly_change": number,
        "runway_change_months": number,
        "break_even_months": number or null
    }},
    "risk_assessment": {{
        "risk_level": "low|medium|high",
        "key_risks": ["risk1", "risk2"],
        "mitigations": ["mitigation1", "mitigation2"]
    }},
    "recommendation": {{
        "verdict": "recommended|neutral|not_recommended",
        "reasoning": "explanation",
        "conditions": ["condition for success"],
        "alternatives": ["alternative option"]
    }},
    "optimal_timing": "When to implement this",
    "action_items": ["action1", "action2"]
}}"""

        return await self.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.3,
            context=context,
        )
    
    async def get_tax_advice(
        self,
        context: FinancialContext,
        specific_question: str = None,
    ) -> AIResponse:
        prompt = f"""Provide comprehensive tax advice for this self-employed individual.

{f"Specific Question: {specific_question}" if specific_question else "Provide general tax optimization advice."}

Consider:
- Illinois state tax (4.95% flat rate)
- Self-employment tax (15.3% on 92.35% of net earnings)
- Federal tax brackets for {context.filing_status}
- Quarterly estimated tax requirements
- Schedule C deductions

Respond in JSON format:
{{
    "current_situation": {{
        "estimated_annual_income": number,
        "estimated_deductions": number,
        "estimated_taxable_income": number,
        "estimated_tax_liability": {{
            "federal": number,
            "state": number,
            "self_employment": number,
            "total": number
        }},
        "effective_tax_rate": number,
        "marginal_tax_rate": number
    }},
    "optimization_opportunities": [
        {{
            "strategy": "name",
            "description": "detailed explanation",
            "potential_savings": number,
            "implementation": "how to do it",
            "deadline": "YYYY-MM-DD or null",
            "complexity": "low|medium|high",
            "risk": "low|medium|high"
        }}
    ],
    "missing_deductions": [
        {{
            "deduction": "name",
            "schedule_c_line": "line number",
            "typical_amount": number,
            "documentation_required": "what's needed"
        }}
    ],
    "quarterly_estimates": {{
        "next_payment_due": "YYYY-MM-DD",
        "recommended_amount": number,
        "safe_harbor_amount": number,
        "underpayment_penalty_risk": boolean
    }},
    "retirement_options": {{
        "sep_ira_max": number,
        "solo_401k_max": number,
        "recommended_contribution": number,
        "tax_savings": number
    }},
    "immediate_actions": [
        {{
            "action": "description",
            "priority": "high|medium|low",
            "deadline": "YYYY-MM-DD or null",
            "impact": number
        }}
    ],
    "warnings": ["warning1", "warning2"],
    "answer": "Direct answer to the specific question if asked"
}}"""

        return await self.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.3,
            context=context,
        )
    
    async def process_receipt(
        self,
        image_base64: str,
        context: FinancialContext = None,
    ) -> AIResponse:
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": """Extract information from this receipt and categorize the expense.

Respond in JSON format:
{
    "merchant_name": "string",
    "date": "YYYY-MM-DD",
    "total_amount": number,
    "subtotal": number,
    "tax_amount": number,
    "tip_amount": number or null,
    "items": [{"description": "string", "amount": number}],
    "payment_method": "string or null",
    "category": "string",
    "schedule_c_category": "string or null",
    "is_business_expense": boolean,
    "business_percentage": number 0-100,
    "confidence": number 0-1,
    "notes": "any relevant observations"
}"""
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    }
                ]
            }
        ]
        
        return await self.chat(
            messages=messages,
            model=AIModel.GPT4_VISION.value,
            response_format=ResponseFormat.JSON,
            temperature=0.2,
            context=context,
        )
