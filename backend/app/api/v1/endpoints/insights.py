from datetime import datetime, date
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel

from app.api.deps import (
    get_db, get_current_user, get_ai_engine, get_financial_context,
    check_feature_access
)
from app.models.user import User
from app.models.ai_conversation import AIInsight, InsightType, InsightPriority
from app.services.ai.engine import AIEngine
from app.services.ai.context import FinancialContext
from app.services.ai.insights import InsightEngine, RealTimeInsightGenerator

router = APIRouter()


@router.get("", response_model=dict)
async def get_insights(
    current_user: User = Depends(check_feature_access("ai_insights")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
    max_insights: int = Query(10, ge=1, le=20),
    insight_type: Optional[str] = None,
    priority: Optional[str] = None,
) -> Any:
    """Get AI-generated financial insights."""
    
    insight_engine = InsightEngine(engine, db)
    insights = await insight_engine.generate_all_insights(context, max_insights)
    
    if insight_type:
        try:
            type_enum = InsightType(insight_type)
            insights = [i for i in insights if i.insight_type == type_enum]
        except ValueError:
            pass
    
    if priority:
        try:
            from app.services.ai.insights import InsightPriority as IPriority
            priority_enum = IPriority(priority)
            insights = [i for i in insights if i.priority == priority_enum]
        except ValueError:
            pass
    
    return {
        "insights": [i.to_dict() for i in insights],
        "count": len(insights),
        "financial_health": {
            "score": context.health_score,
            "status": context.financial_health.value,
        },
    }


@router.get("/daily-digest", response_model=dict)
async def get_daily_digest(
    current_user: User = Depends(check_feature_access("ai_insights")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get daily financial digest with AI summary."""
    
    generator = RealTimeInsightGenerator(engine, db)
    digest = await generator.generate_daily_digest(context)
    
    return digest


@router.get("/stored", response_model=dict)
async def get_stored_insights(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    is_read: Optional[bool] = None,
    is_actioned: Optional[bool] = None,
) -> Any:
    """Get stored insights from database."""
    
    query = db.query(AIInsight).filter(
        AIInsight.user_id == current_user.id,
        AIInsight.is_active == True,
        AIInsight.is_dismissed == False,
    )
    
    if is_read is not None:
        query = query.filter(AIInsight.is_read == is_read)
    if is_actioned is not None:
        query = query.filter(AIInsight.is_actioned == is_actioned)
    
    total = query.count()
    insights = query.order_by(desc(AIInsight.created_at)).offset(skip).limit(limit).all()
    
    return {
        "insights": [i.to_dict() for i in insights],
        "total": total,
        "unread_count": query.filter(AIInsight.is_read == False).count(),
    }


@router.get("/{insight_id}", response_model=dict)
async def get_insight(
    insight_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get specific insight details."""
    
    insight = db.query(AIInsight).filter(
        AIInsight.id == insight_id,
        AIInsight.user_id == current_user.id,
    ).first()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    if not insight.is_read:
        insight.mark_read()
        db.commit()
    
    return insight.to_dict()


@router.post("/{insight_id}/read", response_model=dict)
async def mark_insight_read(
    insight_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Mark insight as read."""
    
    insight = db.query(AIInsight).filter(
        AIInsight.id == insight_id,
        AIInsight.user_id == current_user.id,
    ).first()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    insight.mark_read()
    db.commit()
    
    return {"message": "Insight marked as read"}


@router.post("/{insight_id}/dismiss", response_model=dict)
async def dismiss_insight(
    insight_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Dismiss an insight."""
    
    insight = db.query(AIInsight).filter(
        AIInsight.id == insight_id,
        AIInsight.user_id == current_user.id,
    ).first()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    insight.dismiss()
    db.commit()
    
    return {"message": "Insight dismissed"}


@router.post("/{insight_id}/action", response_model=dict)
async def mark_insight_actioned(
    insight_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Mark insight as actioned."""
    
    insight = db.query(AIInsight).filter(
        AIInsight.id == insight_id,
        AIInsight.user_id == current_user.id,
    ).first()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    insight.mark_actioned()
    db.commit()
    
    return {"message": "Insight marked as actioned"}


@router.post("/{insight_id}/feedback", response_model=dict)
async def provide_insight_feedback(
    insight_id: UUID,
    rating: int = Query(..., ge=1, le=5),
    helpful: Optional[bool] = None,
    comment: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Provide feedback on an insight."""
    
    insight = db.query(AIInsight).filter(
        AIInsight.id == insight_id,
        AIInsight.user_id == current_user.id,
    ).first()
    
    if not insight:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insight not found",
        )
    
    insight.provide_feedback(rating, helpful, comment)
    db.commit()
    
    return {"message": "Feedback recorded"}


@router.get("/types/list", response_model=dict)
async def list_insight_types() -> Any:
    """Get available insight types."""
    
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in InsightType
        ],
        "priorities": [
            {"value": p.value, "name": p.name.title()}
            for p in InsightPriority
        ],
    }
