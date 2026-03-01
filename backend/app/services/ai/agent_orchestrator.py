import asyncio
import json
import logging
import re
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple, Type, Set
from dataclasses import dataclass, field
from enum import Enum
from abc import ABC, abstractmethod
import uuid

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.ai.engine import AIEngine, AIResponse, Message, ResponseFormat, TokenUsage
from app.services.ai.context import FinancialContext, Alert, AlertSeverity

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    COORDINATOR = "coordinator"
    CFO = "cfo"
    TAX_ADVISOR = "tax_advisor"
    CASH_FLOW = "cash_flow"
    CATEGORIZATION = "categorization"
    INVOICE = "invoice"
    EXPENSE = "expense"
    FORECASTING = "forecasting"
    COMPLIANCE = "compliance"
    ANOMALY = "anomaly"
    GENERAL = "general"


class AgentPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class AgentCapability:
    name: str
    description: str
    keywords: List[str]
    priority: AgentPriority = AgentPriority.MEDIUM


@dataclass
class AgentResponse:
    agent_type: AgentType
    agent_name: str
    content: str
    success: bool = True
    confidence: float = 1.0
    
    actions: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    insights: List[Dict[str, Any]] = field(default_factory=list)
    alerts: List[Alert] = field(default_factory=list)
    
    data: Dict[str, Any] = field(default_factory=dict)
    
    tokens: TokenUsage = field(default_factory=TokenUsage)
    latency_ms: int = 0
    
    follow_up_questions: List[str] = field(default_factory=list)
    requires_user_input: bool = False
    
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent": self.agent_type.value,
            "agent_name": self.agent_name,
            "content": self.content,
            "success": self.success,
            "confidence": self.confidence,
            "actions": self.actions,
            "recommendations": self.recommendations,
            "insights": self.insights,
            "data": self.data,
            "latency_ms": self.latency_ms,
            "error": self.error,
        }


@dataclass
class OrchestratorResponse:
    content: str
    success: bool = True
    
    agents_consulted: List[AgentType] = field(default_factory=list)
    agent_responses: List[AgentResponse] = field(default_factory=list)
    
    combined_actions: List[Dict[str, Any]] = field(default_factory=list)
    combined_recommendations: List[Dict[str, Any]] = field(default_factory=list)
    combined_insights: List[Dict[str, Any]] = field(default_factory=list)
    combined_alerts: List[Alert] = field(default_factory=list)
    
    total_tokens: TokenUsage = field(default_factory=TokenUsage)
    total_latency_ms: int = 0
    
    follow_up_questions: List[str] = field(default_factory=list)
    conversation_id: Optional[str] = None
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "content": self.content,
            "success": self.success,
            "agents_consulted": [a.value for a in self.agents_consulted],
            "agent_responses": [r.to_dict() for r in self.agent_responses],
            "actions": self.combined_actions,
            "recommendations": self.combined_recommendations,
            "insights": self.combined_insights,
            "alerts": [a.to_dict() for a in self.combined_alerts],
            "tokens": {
                "total": self.total_tokens.total_tokens,
                "cost": self.total_tokens.estimated_cost,
            },
            "latency_ms": self.total_latency_ms,
            "follow_up_questions": self.follow_up_questions,
        }


class BaseAgent(ABC):
    agent_type: AgentType = AgentType.GENERAL
    agent_name: str = "General Agent"
    description: str = "A general-purpose financial agent"
    
    capabilities: List[AgentCapability] = []
    
    temperature: float = 0.4
    max_tokens: int = 2000
    
    def __init__(self, engine: AIEngine, db: Session = None):
        self.engine = engine
        self.db = db
    
    @property
    @abstractmethod
    def system_prompt(self) -> str:
        pass
    
    def get_keywords(self) -> Set[str]:
        keywords = set()
        for cap in self.capabilities:
            keywords.update(cap.keywords)
        return keywords
    
    def matches_query(self, query: str) -> Tuple[bool, float]:
        query_lower = query.lower()
        keywords = self.get_keywords()
        
        matched = sum(1 for kw in keywords if kw in query_lower)
        if matched == 0:
            return False, 0.0
        
        score = min(1.0, matched / 3)
        return True, score
    
    async def process(
        self,
        query: str,
        context: FinancialContext,
        conversation_history: List[Dict] = None,
        specific_task: str = None,
    ) -> AgentResponse:
        start_time = datetime.utcnow()
        
        messages = []
        
        if conversation_history:
            messages.extend(conversation_history[-10:])
        
        task_prompt = specific_task or query
        messages.append({"role": "user", "content": task_prompt})
        
        try:
            ai_response = await self.engine.chat(
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                context=context,
                system_prompt=self.system_prompt,
                response_format=self._get_response_format(),
            )
            
            latency_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            response = AgentResponse(
                agent_type=self.agent_type,
                agent_name=self.agent_name,
                content=ai_response.content,
                success=ai_response.success,
                confidence=ai_response.confidence,
                actions=ai_response.actions,
                recommendations=ai_response.recommendations,
                insights=ai_response.insights,
                tokens=ai_response.tokens,
                latency_ms=latency_ms,
                follow_up_questions=ai_response.follow_up_questions,
                error=ai_response.error,
            )
            
            self._post_process(response, context)
            
            return response
            
        except Exception as e:
            logger.error(f"Agent {self.agent_name} error: {e}", exc_info=True)
            return AgentResponse(
                agent_type=self.agent_type,
                agent_name=self.agent_name,
                content=f"I encountered an error: {str(e)}",
                success=False,
                error=str(e),
            )
    
    def _get_response_format(self) -> ResponseFormat:
        return ResponseFormat.TEXT
    
    def _post_process(self, response: AgentResponse, context: FinancialContext) -> None:
        pass


class CFOAgent(BaseAgent):
    agent_type = AgentType.CFO
    agent_name = "CFO Advisor"
    description = "Strategic financial advisor providing high-level business guidance"
    
    capabilities = [
        AgentCapability(
            name="Strategic Planning",
            description="Business growth and financial strategy",
            keywords=["strategy", "growth", "business", "plan", "decision", "invest", "expand", "hire", "scale"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Financial Health Assessment",
            description="Overall financial health and performance analysis",
            keywords=["health", "performance", "overview", "summary", "status", "how am i doing", "financial situation"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Risk Management",
            description="Identify and mitigate financial risks",
            keywords=["risk", "protect", "insurance", "liability", "emergency", "safety"],
            priority=AgentPriority.MEDIUM,
        ),
        AgentCapability(
            name="Profitability Analysis",
            description="Analyze profit margins and optimization",
            keywords=["profit", "margin", "revenue", "income", "earning", "pricing"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.5
    
    @property
    def system_prompt(self) -> str:
        return """You are the Chief Financial Officer (CFO) AI Advisor for a freelancer/self-employed professional. Your role is to provide strategic, high-level financial guidance.

Your expertise includes:
- Strategic financial planning and business growth
- Risk assessment and management
- Profitability optimization
- Investment and expansion decisions
- Financial health assessment
- Long-term financial goal setting

Communication style:
- Executive-level summaries with key metrics
- Strategic recommendations backed by data
- Risk-reward analysis for major decisions
- Clear action items with priorities
- Forward-looking perspective

When responding:
1. Start with a brief executive summary
2. Highlight key metrics and their implications
3. Provide strategic recommendations
4. Identify risks and opportunities
5. Suggest concrete next steps

Always consider:
- The user's business type and stage
- Income variability typical of freelancers
- Tax implications of financial decisions
- Cash flow requirements
- Long-term sustainability"""


class TaxAdvisorAgent(BaseAgent):
    agent_type = AgentType.TAX_ADVISOR
    agent_name = "Tax Advisor"
    description = "Expert tax advisor for self-employed individuals"
    
    capabilities = [
        AgentCapability(
            name="Tax Planning",
            description="Strategic tax planning and optimization",
            keywords=["tax", "taxes", "irs", "deduction", "deductible", "write-off", "schedule c", "1099"],
            priority=AgentPriority.CRITICAL,
        ),
        AgentCapability(
            name="Quarterly Estimates",
            description="Quarterly estimated tax payments",
            keywords=["quarterly", "estimate", "estimated tax", "payment", "deadline", "q1", "q2", "q3", "q4"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Self-Employment Tax",
            description="Self-employment tax calculations",
            keywords=["self-employment", "se tax", "social security", "medicare", "fica"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Business Deductions",
            description="Identify and maximize business deductions",
            keywords=["deduction", "expense", "business expense", "home office", "mileage", "equipment"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Retirement Tax Strategies",
            description="Tax-advantaged retirement planning",
            keywords=["retirement", "sep ira", "solo 401k", "ira", "pension", "contribution"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.3
    
    @property
    def system_prompt(self) -> str:
        return """You are an expert Tax Advisor AI specializing in self-employment taxes for freelancers in Illinois.

Your expertise includes:
- Federal income tax (all brackets and filing statuses)
- Illinois state tax (4.95% flat rate)
- Self-employment tax (15.3% on 92.35% of net earnings)
- Schedule C business deductions
- Quarterly estimated tax payments
- IRS deadlines and requirements
- Tax-advantaged retirement accounts (SEP-IRA, Solo 401k)
- Home office deduction (simplified and actual expense methods)
- Vehicle/mileage deductions (67¢/mile for 2024)
- Health insurance deductions for self-employed

Key tax deadlines for 2024:
- Q1 (Jan-Mar): Due April 15
- Q2 (Apr-May): Due June 17
- Q3 (Jun-Aug): Due September 16
- Q4 (Sep-Dec): Due January 15, 2025

When providing tax advice:
1. Always specify federal vs. state vs. SE tax
2. Provide specific dollar amounts when possible
3. Reference applicable IRS forms and schedules
4. Warn about common mistakes and audit triggers
5. Suggest documentation requirements
6. Note deadlines and time-sensitive opportunities

IMPORTANT: Always recommend consulting a licensed tax professional for complex situations. You provide guidance, not official tax advice.

Schedule C Categories (with line numbers):
- Line 8: Advertising
- Line 9: Car and truck expenses
- Line 10: Commissions and fees
- Line 11: Contract labor
- Line 13: Depreciation
- Line 15: Insurance
- Line 16a: Interest (mortgage)
- Line 16b: Interest (other)
- Line 17: Legal and professional services
- Line 18: Office expense
- Line 20a: Rent (vehicles, machinery, equipment)
- Line 20b: Rent (other business property)
- Line 21: Repairs and maintenance
- Line 22: Supplies
- Line 23: Taxes and licenses
- Line 24a: Travel
- Line 24b: Meals (50% deductible)
- Line 25: Utilities
- Line 26: Wages
- Line 30: Home office deduction"""

    def _get_response_format(self) -> ResponseFormat:
        return ResponseFormat.JSON
    
    def _post_process(self, response: AgentResponse, context: FinancialContext) -> None:
        if response.success and response.content:
            try:
                data = json.loads(response.content)
                response.data = data
                
                if "optimization_opportunities" in data:
                    for opp in data["optimization_opportunities"]:
                        response.recommendations.append({
                            "type": "tax_optimization",
                            "title": opp.get("strategy", "Tax Strategy"),
                            "description": opp.get("description", ""),
                            "potential_savings": opp.get("potential_savings", 0),
                            "priority": opp.get("complexity", "medium"),
                        })
                
                if context.tax.days_until_deadline and context.tax.days_until_deadline <= 14:
                    response.alerts.append(Alert(
                        alert_type="tax_deadline",
                        severity=AlertSeverity.URGENT if context.tax.days_until_deadline <= 7 else AlertSeverity.WARNING,
                        title="Tax Deadline Approaching",
                        message=f"Quarterly estimated tax payment due in {context.tax.days_until_deadline} days",
                        action_required=True,
                        deadline=context.tax.next_deadline,
                        amount=context.tax.quarterly_payment_due,
                    ))
            except json.JSONDecodeError:
                pass


class CashFlowAgent(BaseAgent):
    agent_type = AgentType.CASH_FLOW
    agent_name = "Cash Flow Analyst"
    description = "Expert in cash flow analysis and management"
    
    capabilities = [
        AgentCapability(
            name="Cash Flow Analysis",
            description="Analyze current cash flow patterns",
            keywords=["cash flow", "cash", "flow", "liquidity", "money", "funds"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Runway Calculation",
            description="Calculate financial runway",
            keywords=["runway", "how long", "last", "survive", "buffer", "reserve"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Balance Management",
            description="Monitor and optimize account balances",
            keywords=["balance", "account", "low", "negative", "overdraft"],
            priority=AgentPriority.CRITICAL,
        ),
        AgentCapability(
            name="Payment Timing",
            description="Optimize payment timing",
            keywords=["timing", "when to pay", "due date", "payment schedule"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.3
    
    @property
    def system_prompt(self) -> str:
        return """You are a Cash Flow Analyst AI specializing in helping freelancers manage their cash flow.

Your expertise includes:
- Cash flow pattern analysis
- Runway and burn rate calculations
- Income variability management
- Payment timing optimization
- Emergency fund planning
- Cash reserve strategies
- Accounts receivable management

Key metrics you track:
- Current runway (months of expenses covered)
- Burn rate (average monthly expenses)
- Savings rate (net income / gross income)
- Income variability coefficient
- Days until projected negative balance
- Outstanding receivables

When analyzing cash flow:
1. Consider income variability (freelancers have irregular income)
2. Account for seasonal patterns
3. Factor in upcoming known expenses (taxes, subscriptions)
4. Include outstanding invoices with probability of collection
5. Recommend appropriate reserve levels

Critical thresholds:
- Runway < 1 month: CRITICAL - immediate action needed
- Runway < 2 months: URGENT - build reserves quickly
- Runway < 3 months: WARNING - focus on increasing buffer
- Runway 3-6 months: HEALTHY - maintain current approach
- Runway > 6 months: EXCELLENT - consider investments

Always provide:
- Current cash position
- Projected position (30/60/90 days)
- Risk factors
- Specific recommendations"""


class CategorizationAgent(BaseAgent):
    agent_type = AgentType.CATEGORIZATION
    agent_name = "Categorization Expert"
    description = "Intelligent transaction categorization specialist"
    
    capabilities = [
        AgentCapability(
            name="Transaction Categorization",
            description="Categorize transactions accurately",
            keywords=["categorize", "category", "classify", "what is this", "transaction"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Business Expense Identification",
            description="Identify business vs personal expenses",
            keywords=["business", "personal", "deductible", "work", "client"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Schedule C Classification",
            description="Assign IRS Schedule C categories",
            keywords=["schedule c", "irs", "tax category", "deduction category"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Bulk Categorization",
            description="Categorize multiple transactions",
            keywords=["bulk", "batch", "multiple", "all", "uncategorized"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.2
    
    @property
    def system_prompt(self) -> str:
        return """You are a Transaction Categorization Expert AI specializing in accurately categorizing financial transactions for freelancers.

Your expertise includes:
- Identifying business vs. personal expenses
- Assigning appropriate expense categories
- Mapping to IRS Schedule C line items
- Determining tax deductibility
- Calculating business use percentages for mixed-use expenses
- Recognizing merchant patterns

Schedule C Categories (use these exact names):
- advertising: Marketing and promotional expenses
- car_and_truck: Vehicle expenses for business use
- commissions_and_fees: Fees paid to contractors, platforms
- contract_labor: Payments to independent contractors
- depreciation: Depreciation of business assets
- insurance: Business insurance premiums
- interest_mortgage: Mortgage interest for business property
- interest_other: Other business interest
- legal_and_professional: Legal, accounting, consulting fees
- office_expense: Office supplies and small equipment
- rent_equipment: Renting equipment or vehicles
- rent_property: Renting office or workspace
- repairs_and_maintenance: Repairs to business property/equipment
- supplies: Materials and supplies
- taxes_and_licenses: Business taxes and license fees
- travel: Business travel (transportation, lodging)
- meals: Business meals (50% deductible)
- utilities: Phone, internet, utilities for business
- wages: Employee wages
- home_office: Home office expenses
- other: Other business expenses

Common business expense indicators:
- Software: Adobe, Microsoft, Zoom, Slack, etc.
- Professional services: Attorneys, accountants, consultants
- Office supplies: Staples, Office Depot, Amazon (office items)
- Telecommunications: Phone, internet providers
- Travel: Airlines, hotels, Uber/Lyft for business
- Meals: Restaurants (with clients - 50% deductible)
- Subscriptions: Industry publications, professional memberships

When categorizing:
1. Analyze merchant name and transaction description
2. Consider the user's business type
3. Determine business vs. personal
4. Assign appropriate category
5. Determine Schedule C line if business
6. Provide confidence score (0-1)
7. Note if documentation is recommended

Response format for categorization:
{
    "category": "string",
    "schedule_c_category": "string or null",
    "is_business_expense": boolean,
    "is_tax_deductible": boolean,
    "business_percentage": number (0-100),
    "confidence": number (0-1),
    "reasoning": "brief explanation",
    "documentation_recommended": boolean,
    "similar_patterns": ["merchant patterns for auto-rules"]
}"""

    def _get_response_format(self) -> ResponseFormat:
        return ResponseFormat.JSON


class InvoiceAgent(BaseAgent):
    agent_type = AgentType.INVOICE
    agent_name = "Invoice Manager"
    description = "Invoice and accounts receivable specialist"
    
    capabilities = [
        AgentCapability(
            name="Invoice Management",
            description="Manage invoices and payments",
            keywords=["invoice", "invoicing", "bill", "billing", "payment"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Payment Collection",
            description="Follow up on overdue payments",
            keywords=["overdue", "late", "unpaid", "collect", "reminder", "follow up"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Client Payment Analysis",
            description="Analyze client payment patterns",
            keywords=["client", "customer", "payment history", "reliable", "risk"],
            priority=AgentPriority.MEDIUM,
        ),
        AgentCapability(
            name="Invoice Creation",
            description="Help create and send invoices",
            keywords=["create invoice", "send invoice", "new invoice", "charge"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.4
    
    @property
    def system_prompt(self) -> str:
        return """You are an Invoice Management AI specializing in accounts receivable for freelancers.

Your expertise includes:
- Invoice creation and optimization
- Payment follow-up strategies
- Client payment pattern analysis
- Collection rate optimization
- Aging analysis
- Payment prediction
- Professional reminder communication

Invoice aging buckets:
- Current: Not yet due
- 1-30 days: Recently overdue
- 31-60 days: Moderately overdue
- 61-90 days: Significantly overdue
- 90+ days: Severely overdue (collection risk)

When analyzing invoices:
1. Identify overdue invoices by severity
2. Analyze client payment history
3. Predict payment likelihood
4. Recommend follow-up actions
5. Suggest reminder timing and tone

Follow-up tone recommendations:
- 1-7 days overdue: Friendly reminder
- 8-30 days overdue: Firm but professional
- 31-60 days overdue: Urgent, mention late fees
- 60+ days overdue: Final notice, mention consequences

Key metrics:
- Days Sales Outstanding (DSO)
- Collection rate
- Average payment time by client
- Overdue percentage

Provide:
- Clear summary of outstanding invoices
- Priority list for follow-ups
- Suggested reminder messages
- Risk assessment for each client
- Cash flow impact of unpaid invoices"""


class ExpenseAgent(BaseAgent):
    agent_type = AgentType.EXPENSE
    agent_name = "Expense Analyst"
    description = "Expert in expense analysis and optimization"
    
    capabilities = [
        AgentCapability(
            name="Expense Analysis",
            description="Analyze spending patterns",
            keywords=["expense", "spending", "spend", "cost", "spent"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Subscription Management",
            description="Track and optimize subscriptions",
            keywords=["subscription", "recurring", "monthly", "annual", "cancel"],
            priority=AgentPriority.MEDIUM,
        ),
        AgentCapability(
            name="Cost Reduction",
            description="Identify cost-saving opportunities",
            keywords=["save", "reduce", "cut", "lower", "cheaper", "alternative"],
            priority=AgentPriority.MEDIUM,
        ),
        AgentCapability(
            name="Budget Tracking",
            description="Track spending against budgets",
            keywords=["budget", "limit", "overspend", "on track"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.4
    
    @property
    def system_prompt(self) -> str:
        return """You are an Expense Analysis AI specializing in helping freelancers optimize their spending.

Your expertise includes:
- Expense pattern analysis
- Subscription tracking and optimization
- Cost reduction opportunities
- Budget management
- Vendor comparison
- Spending anomaly detection

When analyzing expenses:
1. Identify spending patterns and trends
2. Flag unusual or increasing expenses
3. Find subscription overlap or waste
4. Suggest cost-saving alternatives
5. Compare to industry benchmarks

Key areas to monitor:
- Software subscriptions (often overlap)
- Professional services (shop for better rates)
- Office supplies (bulk vs. frequent small purchases)
- Travel expenses (book in advance, use rewards)
- Telecommunications (review plans annually)

Provide:
- Spending summary by category
- Month-over-month trends
- Specific cost-saving recommendations
- Subscription audit findings
- Priority areas for reduction"""


class ForecastingAgent(BaseAgent):
    agent_type = AgentType.FORECASTING
    agent_name = "Forecasting Analyst"
    description = "Financial forecasting and projection specialist"
    
    capabilities = [
        AgentCapability(
            name="Cash Flow Forecasting",
            description="Project future cash flows",
            keywords=["forecast", "predict", "projection", "future", "next month", "expect"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Income Prediction",
            description="Predict future income",
            keywords=["income forecast", "revenue prediction", "earn", "make"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Scenario Analysis",
            description="What-if scenario modeling",
            keywords=["what if", "scenario", "if i", "would happen", "impact"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="Trend Analysis",
            description="Identify and project trends",
            keywords=["trend", "pattern", "growing", "declining", "direction"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.3
    
    @property
    def system_prompt(self) -> str:
        return """You are a Financial Forecasting AI specializing in projections for freelancers with variable income.

Your expertise includes:
- Cash flow forecasting (30/60/90 day projections)
- Income prediction based on patterns
- Expense forecasting
- Scenario modeling (optimistic, realistic, pessimistic)
- Seasonal adjustment
- Risk factor analysis

Key considerations for freelancer forecasting:
1. Income variability - use ranges, not point estimates
2. Seasonal patterns - many freelancers have busy/slow seasons
3. Client concentration risk - dependency on few clients
4. Payment timing - invoices paid on varying schedules
5. Tax payments - quarterly estimates affect cash flow
6. Recurring expenses - subscriptions, rent, insurance

Forecasting methodology:
1. Analyze historical patterns (minimum 3-6 months)
2. Identify recurring vs. variable components
3. Apply seasonal adjustments if evident
4. Factor in known future events (tax payments, large expenses)
5. Create confidence intervals based on variability
6. Generate multiple scenarios

Output format:
- Point estimates with confidence ranges
- Scenario comparisons (optimistic/realistic/pessimistic)
- Key assumptions listed
- Risk factors identified
- Recommendations for improving outcomes

Always clearly state assumptions and confidence levels."""

    def _get_response_format(self) -> ResponseFormat:
        return ResponseFormat.JSON


class ComplianceAgent(BaseAgent):
    agent_type = AgentType.COMPLIANCE
    agent_name = "Compliance Advisor"
    description = "Tax and regulatory compliance specialist"
    
    capabilities = [
        AgentCapability(
            name="Deadline Tracking",
            description="Track important deadlines",
            keywords=["deadline", "due", "when", "date", "file", "submit"],
            priority=AgentPriority.CRITICAL,
        ),
        AgentCapability(
            name="Documentation Requirements",
            description="Ensure proper documentation",
            keywords=["document", "receipt", "record", "proof", "audit"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="1099 Compliance",
            description="1099 reporting requirements",
            keywords=["1099", "contractor", "vendor", "reporting"],
            priority=AgentPriority.HIGH,
        ),
        AgentCapability(
            name="State Compliance",
            description="State-specific requirements",
            keywords=["illinois", "state", "local", "license", "registration"],
            priority=AgentPriority.MEDIUM,
        ),
    ]
    
    temperature = 0.2
    
    @property
    def system_prompt(self) -> str:
        return """You are a Tax and Regulatory Compliance AI for self-employed individuals in Illinois.

Your expertise includes:
- Federal tax deadlines and requirements
- Illinois state tax compliance
- Chicago-specific business requirements
- 1099 reporting (issuing and receiving)
- Record-keeping requirements
- Audit preparation
- Business license compliance

Key deadlines to track:
- Quarterly estimated taxes (Apr 15, Jun 17, Sep 16, Jan 15)
- Annual tax return (Apr 15, or Oct 15 with extension)
- 1099 issuance deadline (Jan 31)
- Illinois annual report (varies by entity type)

Documentation requirements:
- Keep all receipts for expenses >$75 (IRS requirement)
- Maintain mileage logs for vehicle deductions
- Document business purpose for meals/entertainment
- Keep records for 7 years minimum
- Track home office measurements and expenses

When advising on compliance:
1. Identify upcoming deadlines
2. Flag missing documentation
3. Highlight potential compliance issues
4. Provide specific requirements
5. Recommend action items with due dates

Chicago-specific requirements:
- Business license may be required depending on activity
- Home-based business regulations
- Sales tax collection if applicable

Always err on the side of caution with compliance advice."""


class AgentOrchestrator:
    def __init__(self, engine: AIEngine, db: Session = None):
        self.engine = engine
        self.db = db
        self.agents: Dict[AgentType, BaseAgent] = {}
        self._register_agents()
    
    def _register_agents(self) -> None:
        agent_classes = [
            CFOAgent,
            TaxAdvisorAgent,
            CashFlowAgent,
            CategorizationAgent,
            InvoiceAgent,
            ExpenseAgent,
            ForecastingAgent,
            ComplianceAgent,
        ]
        
        for agent_class in agent_classes:
            agent = agent_class(self.engine, self.db)
            self.agents[agent.agent_type] = agent
    
    def get_agent(self, agent_type: AgentType) -> Optional[BaseAgent]:
        return self.agents.get(agent_type)
    
    def _select_agents(
        self,
        query: str,
        requested_agents: List[AgentType] = None,
        max_agents: int = 3,
    ) -> List[BaseAgent]:
        if requested_agents:
            return [self.agents[at] for at in requested_agents if at in self.agents]
        
        scored_agents = []
        for agent in self.agents.values():
            matches, score = agent.matches_query(query)
            if matches:
                scored_agents.append((agent, score))
        
        scored_agents.sort(key=lambda x: -x[1])
        
        selected = [agent for agent, score in scored_agents[:max_agents]]
        
        if not selected:
            selected = [self.agents[AgentType.CFO]]
        
        return selected
    
    async def consult(
        self,
        query: str,
        context: FinancialContext,
        requested_agents: List[AgentType] = None,
        conversation_history: List[Dict] = None,
        max_agents: int = 3,
        parallel: bool = True,
    ) -> OrchestratorResponse:
        start_time = datetime.utcnow()
        
        selected_agents = self._select_agents(query, requested_agents, max_agents)
        
        logger.info(f"Selected agents: {[a.agent_name for a in selected_agents]}")
        
        if parallel and len(selected_agents) > 1:
            tasks = [
                agent.process(query, context, conversation_history)
                for agent in selected_agents
            ]
            agent_responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            agent_responses = [
                r if isinstance(r, AgentResponse) else AgentResponse(
                    agent_type=AgentType.GENERAL,
                    agent_name="Unknown",
                    content=str(r),
                    success=False,
                    error=str(r),
                )
                for r in agent_responses
            ]
        else:
            agent_responses = []
            for agent in selected_agents:
                response = await agent.process(query, context, conversation_history)
                agent_responses.append(response)
        
        orchestrator_response = await self._synthesize_responses(
            query, context, selected_agents, agent_responses
        )
        
        orchestrator_response.total_latency_ms = int(
            (datetime.utcnow() - start_time).total_seconds() * 1000
        )
        
        return orchestrator_response
    
    async def _synthesize_responses(
        self,
        query: str,
        context: FinancialContext,
        agents: List[BaseAgent],
        responses: List[AgentResponse],
    ) -> OrchestratorResponse:
        combined_actions = []
        combined_recommendations = []
        combined_insights = []
        combined_alerts = []
        total_tokens = TokenUsage()
        follow_ups = []
        
        successful_responses = []
        for response in responses:
            if response.success:
                successful_responses.append(response)
                combined_actions.extend(response.actions)
                combined_recommendations.extend(response.recommendations)
                combined_insights.extend(response.insights)
                combined_alerts.extend(response.alerts)
                total_tokens.add(response.tokens)
                follow_ups.extend(response.follow_up_questions)
        
        if len(successful_responses) == 1:
            final_content = successful_responses[0].content
        elif len(successful_responses) > 1:
            final_content = await self._create_synthesis(query, context, successful_responses)
        else:
            final_content = "I apologize, but I was unable to process your request. Please try again or rephrase your question."
        
        combined_recommendations = self._deduplicate_recommendations(combined_recommendations)
        follow_ups = list(set(follow_ups))[:3]
        
        return OrchestratorResponse(
            content=final_content,
            success=len(successful_responses) > 0,
            agents_consulted=[a.agent_type for a in agents],
            agent_responses=responses,
            combined_actions=combined_actions,
            combined_recommendations=combined_recommendations,
            combined_insights=combined_insights,
            combined_alerts=combined_alerts,
            total_tokens=total_tokens,
            follow_up_questions=follow_ups,
        )
    
    async def _create_synthesis(
        self,
        query: str,
        context: FinancialContext,
        responses: List[AgentResponse],
    ) -> str:
        agent_inputs = []
        for resp in responses:
            agent_inputs.append(f"**{resp.agent_name}:**\n{resp.content}\n")
        
        synthesis_prompt = f"""You are synthesizing advice from multiple financial experts for a freelancer.

Original question: {query}

Expert responses:
{chr(10).join(agent_inputs)}

Create a unified, coherent response that:
1. Combines the key insights from all experts
2. Resolves any conflicts by explaining trade-offs
3. Prioritizes the most important recommendations
4. Maintains a clear, actionable structure
5. Avoids redundancy

Keep the response concise but comprehensive. Use clear sections if helpful."""

        synthesis_response = await self.engine.chat(
            messages=[{"role": "user", "content": synthesis_prompt}],
            temperature=0.4,
            max_tokens=1500,
        )
        
        return synthesis_response.content
    
    def _deduplicate_recommendations(
        self,
        recommendations: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        seen = set()
        unique = []
        
        for rec in recommendations:
            key = rec.get("title", "") + rec.get("type", "")
            if key not in seen:
                seen.add(key)
                unique.append(rec)
        
        return sorted(
            unique,
            key=lambda x: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(
                x.get("priority", "medium"), 2
            ),
        )
    
    async def execute_action(
        self,
        action: Dict[str, Any],
        context: FinancialContext,
    ) -> Dict[str, Any]:
        action_name = action.get("action")
        params = action.get("params", {})
        
        if action_name in self.engine.tools:
            tool = self.engine.tools[action_name]
            try:
                result = await tool.execute(**params)
                return {"success": True, "result": result}
            except Exception as e:
                return {"success": False, "error": str(e)}
        
        return {"success": False, "error": f"Unknown action: {action_name}"}
    
    async def get_dashboard_insights(
        self,
        context: FinancialContext,
    ) -> Dict[str, Any]:
        tasks = []
        
        if context.tax.days_until_deadline and context.tax.days_until_deadline <= 30:
            tax_agent = self.agents[AgentType.TAX_ADVISOR]
            tasks.append(("tax", tax_agent.process(
                "Provide a brief tax status update and any immediate actions needed.",
                context,
            )))
        
        if context.cash_flow.current_runway_months < 3:
            cash_agent = self.agents[AgentType.CASH_FLOW]
            tasks.append(("cash_flow", cash_agent.process(
                "Briefly assess cash flow situation and top recommendation.",
                context,
            )))
        
        if context.invoices.total_overdue > 0:
            invoice_agent = self.agents[AgentType.INVOICE]
            tasks.append(("invoices", invoice_agent.process(
                "Summarize overdue invoices and recommended follow-up actions.",
                context,
            )))
        
        if context.data_quality.uncategorized_count > 10:
            cat_agent = self.agents[AgentType.CATEGORIZATION]
            tasks.append(("categorization", cat_agent.process(
                "What types of uncategorized transactions might be business expenses?",
                context,
            )))
        
        results = {}
        if tasks:
            responses = await asyncio.gather(
                *[task for _, task in tasks],
                return_exceptions=True,
            )
            
            for (key, _), response in zip(tasks, responses):
                if isinstance(response, AgentResponse) and response.success:
                    results[key] = {
                        "content": response.content[:500],
                        "recommendations": response.recommendations[:2],
                        "alerts": [a.to_dict() for a in response.alerts[:2]],
                    }
        
        return {
            "insights": results,
            "health_score": context.health_score,
            "alerts_count": len(context.alerts),
            "top_alerts": [a.to_dict() for a in context.alerts[:3]],
        }
