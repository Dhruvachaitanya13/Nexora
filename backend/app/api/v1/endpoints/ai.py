import json
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api.deps import (
    get_db, get_current_user, get_ai_engine, get_agent_orchestrator,
    get_financial_context, check_feature_access
)
from app.models.user import User
from app.models.ai_conversation import AIConversation, AIMessage, MessageRole, AgentType as DBAgentType, ConversationStatus
from app.services.ai.engine import AIEngine
from app.services.ai.agent_orchestrator import AgentOrchestrator, AgentType
from app.services.ai.context import FinancialContext
from app.services.ai.insights import InsightEngine, RealTimeInsightGenerator
from app.services.ai.categorization import SmartCategorizer
from app.services.ai.forecasting import CashFlowForecaster

router = APIRouter()


class ChatMessage(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    conversation_id: Optional[UUID] = None


class ChatResponse(BaseModel):
    content: str
    conversation_id: str
    agent: Optional[str] = None
    agents_consulted: List[str] = []
    actions: List[dict] = []
    recommendations: List[dict] = []
    insights: List[dict] = []
    follow_up_questions: List[str] = []
    tokens_used: int = 0
    latency_ms: int = 0


class AgentQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=5000)
    agent_type: str
    conversation_id: Optional[UUID] = None


class WhatIfScenario(BaseModel):
    scenario_type: str = Field(..., description="Type of scenario: expense, income, investment, major_purchase, rate_change")
    description: str = Field(..., max_length=1000)
    amount: Optional[float] = None
    is_recurring: bool = False
    frequency: Optional[str] = None
    start_date: Optional[str] = None
    additional_params: Optional[dict] = None


class TaxQuestionRequest(BaseModel):
    question: Optional[str] = None
    focus_areas: Optional[List[str]] = None


class ForecastRequest(BaseModel):
    months: int = Field(3, ge=1, le=12)
    include_scenarios: bool = True


class CategorizationRequest(BaseModel):
    merchant_name: str
    amount: float
    description: Optional[str] = None
    transaction_date: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    orchestrator: AgentOrchestrator = Depends(get_agent_orchestrator),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    if message.conversation_id:
        conversation = db.query(AIConversation).filter(
            AIConversation.id == message.conversation_id,
            AIConversation.user_id == current_user.id,
        ).first()
        
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
    else:
        conversation = AIConversation(
            user_id=current_user.id,
            status=ConversationStatus.ACTIVE,
            primary_agent=DBAgentType.GENERAL,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    user_message = AIMessage(
        conversation_id=conversation.id,
        role=MessageRole.USER,
        content=message.content,
    )
    db.add(user_message)
    
    history = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation.id,
    ).order_by(AIMessage.created_at).limit(20).all()
    
    conversation_history = [
        {"role": m.role.value, "content": m.content}
        for m in history
    ]
    
    response = await orchestrator.consult(
        query=message.content,
        context=context,
        conversation_history=conversation_history,
    )
    
    assistant_message = AIMessage(
        conversation_id=conversation.id,
        role=MessageRole.ASSISTANT,
        content=response.content,
        agent_type=response.agents_consulted[0] if response.agents_consulted else None,
        input_tokens=response.total_tokens.prompt_tokens,
        output_tokens=response.total_tokens.completion_tokens,
        total_tokens=response.total_tokens.total_tokens,
        latency_ms=response.total_latency_ms,
        actions_suggested=response.combined_actions,
    )
    db.add(assistant_message)
    
    conversation.message_count += 2
    conversation.user_message_count += 1
    conversation.assistant_message_count += 1
    conversation.last_message_at = datetime.utcnow()
    conversation.total_tokens_used += response.total_tokens.total_tokens
    
    for agent in response.agents_consulted:
        conversation.add_agent_used(agent)
    
    db.commit()
    
    return ChatResponse(
        content=response.content,
        conversation_id=str(conversation.id),
        agents_consulted=[a.value for a in response.agents_consulted],
        actions=response.combined_actions,
        recommendations=response.combined_recommendations,
        insights=response.combined_insights,
        follow_up_questions=response.follow_up_questions,
        tokens_used=response.total_tokens.total_tokens,
        latency_ms=response.total_latency_ms,
    )


@router.post("/chat/stream")
async def chat_with_ai_stream(
    message: ChatMessage,
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> StreamingResponse:
    messages = [{"role": "user", "content": message.content}]

    async def generate():
        try:
            async for chunk in engine.stream(messages, context=context):
                yield f"data: {json.dumps(chunk)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/agents/{agent_type}", response_model=dict)
async def query_specific_agent(
    agent_type: str,
    query: AgentQuery,
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    orchestrator: AgentOrchestrator = Depends(get_agent_orchestrator),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    try:
        agent_enum = AgentType(agent_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid agent type. Valid types: {[a.value for a in AgentType]}",
        )
    
    agent = orchestrator.get_agent(agent_enum)
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_type} not found",
        )
    
    response = await agent.process(query.query, context)
    
    return {
        "agent": response.agent_name,
        "agent_type": response.agent_type.value,
        "content": response.content,
        "success": response.success,
        "confidence": response.confidence,
        "actions": response.actions,
        "recommendations": response.recommendations,
        "insights": response.insights,
        "data": response.data,
        "latency_ms": response.latency_ms,
        "follow_up_questions": response.follow_up_questions,
    }


@router.get("/agents", response_model=dict)
async def list_available_agents(
    current_user: User = Depends(get_current_user),
    orchestrator: AgentOrchestrator = Depends(get_agent_orchestrator),
) -> Any:
    agents = []
    for agent_type, agent in orchestrator.agents.items():
        agents.append({
            "type": agent_type.value,
            "name": agent.agent_name,
            "description": agent.description,
            "capabilities": [
                {"name": c.name, "description": c.description}
                for c in agent.capabilities
            ],
        })
    
    return {"agents": agents}


@router.post("/what-if", response_model=dict)
async def what_if_analysis(
    scenario: WhatIfScenario,
    current_user: User = Depends(check_feature_access("forecasting")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    scenario_data = {
        "type": scenario.scenario_type,
        "description": scenario.description,
        "amount": scenario.amount,
        "is_recurring": scenario.is_recurring,
        "frequency": scenario.frequency,
        "start_date": scenario.start_date,
        **(scenario.additional_params or {}),
    }
    
    response = await engine.what_if_analysis(context, scenario_data)
    
    return response


@router.post("/tax-advice", response_model=dict)
async def get_tax_advice(
    request: TaxQuestionRequest,
    current_user: User = Depends(check_feature_access("tax_optimization")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    response = await engine.get_tax_advice(context, request.question)
    
    try:
        import json
        return json.loads(response.content)
    except:
        return {"content": response.content, "success": response.success}


@router.post("/forecast", response_model=dict)
async def generate_cash_flow_forecast(
    request: ForecastRequest,
    current_user: User = Depends(check_feature_access("forecasting")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    forecaster = CashFlowForecaster(engine, db)
    forecast = await forecaster.generate_forecast(
        context,
        num_months=request.months,
        include_scenarios=request.include_scenarios,
    )
    
    return forecast.to_dict()


@router.post("/categorize", response_model=dict)
async def ai_categorize(
    request: CategorizationRequest,
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    categorizer = SmartCategorizer(engine, db)
    
    transaction_data = {
        "merchant_name": request.merchant_name,
        "amount": request.amount,
        "description": request.description,
        "transaction_date": request.transaction_date,
        "user_id": str(current_user.id),
    }
    
    result = await categorizer.categorize(transaction_data, context)
    
    return result.to_dict()


@router.get("/insights", response_model=dict)
async def get_ai_insights(
    current_user: User = Depends(check_feature_access("ai_insights")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
    max_insights: int = Query(10, ge=1, le=20),
) -> Any:
    insight_engine = InsightEngine(engine, db)
    insights = await insight_engine.generate_all_insights(context, max_insights)
    
    return {
        "insights": [i.to_dict() for i in insights],
        "count": len(insights),
        "financial_health": context.financial_health.value,
        "health_score": context.health_score,
    }


@router.get("/insights/daily", response_model=dict)
async def get_daily_digest(
    current_user: User = Depends(check_feature_access("ai_insights")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    generator = RealTimeInsightGenerator(engine, db)
    digest = await generator.generate_daily_digest(context)
    
    return digest


@router.get("/conversations", response_model=dict)
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
) -> Any:
    query = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id,
    )
    
    if status:
        try:
            status_enum = ConversationStatus(status)
            query = query.filter(AIConversation.status == status_enum)
        except ValueError:
            pass
    
    total = query.count()
    conversations = query.order_by(AIConversation.started_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "conversations": [c.to_dict() for c in conversations],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/conversations/{conversation_id}", response_model=dict)
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == current_user.id,
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation_id,
    ).order_by(AIMessage.created_at).all()
    
    return {
        "conversation": conversation.to_dict(),
        "messages": [m.to_dict() for m in messages],
    }


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == current_user.id,
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    conversation.archive()
    db.commit()


@router.post("/conversations/{conversation_id}/rate", response_model=dict)
async def rate_conversation(
    conversation_id: UUID,
    rating: int = Query(..., ge=1, le=5),
    feedback: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    conversation = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.user_id == current_user.id,
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )
    
    conversation.rate(rating, feedback)
    db.commit()
    
    return {"message": "Thank you for your feedback"}


@router.get("/dashboard-insights", response_model=dict)
async def get_dashboard_ai_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orchestrator: AgentOrchestrator = Depends(get_agent_orchestrator),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    insights = await orchestrator.get_dashboard_insights(context)
    return insights
