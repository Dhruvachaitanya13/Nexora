from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field

from app.api.deps import (
    get_db, get_current_user, get_ai_engine, get_financial_context,
    check_feature_access
)
from app.models.user import User
from app.models.cashflow import CashFlowForecast, CashFlowActual, RecurringTransaction, CashFlowAlert
from app.services.ai.engine import AIEngine
from app.services.ai.context import FinancialContext
from app.services.ai.forecasting import CashFlowForecaster

router = APIRouter()


class ForecastRequest(BaseModel):
    months: int = Field(3, ge=1, le=12)
    include_scenarios: bool = True


class RecurringCreate(BaseModel):
    name: str
    merchant_name: Optional[str] = None
    amount: float
    frequency: str = Field(..., description="daily, weekly, biweekly, monthly, quarterly, annual")
    is_income: bool = False
    is_expense: bool = True
    is_essential: bool = False
    category: Optional[str] = None
    next_expected_date: Optional[date] = None
    notes: Optional[str] = None


class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    frequency: Optional[str] = None
    is_essential: Optional[bool] = None
    category: Optional[str] = None
    next_expected_date: Optional[date] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


@router.get("/summary", response_model=dict)
async def get_cash_flow_summary(
    current_user: User = Depends(get_current_user),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get cash flow summary and health metrics."""
    
    return {
        "current_balance": context.accounts.total_balance,
        "available_balance": context.accounts.available_balance,
        "runway_months": context.cash_flow.current_runway_months,
        "burn_rate": context.cash_flow.burn_rate,
        "savings_rate": context.cash_flow.savings_rate,
        "net_cash_flow": {
            "period": context.cash_flow.net_cash_flow_period,
            "ytd": context.cash_flow.net_cash_flow_ytd,
            "average_monthly": context.cash_flow.average_monthly_net,
        },
        "trend": context.cash_flow.cash_flow_trend,
        "projections": {
            "30_days": context.cash_flow.projected_balance_30d,
            "60_days": context.cash_flow.projected_balance_60d,
            "90_days": context.cash_flow.projected_balance_90d,
        },
        "income": {
            "period": context.income.period_income,
            "ytd": context.income.ytd_income,
            "average_monthly": context.income.average_monthly_income,
            "variability": context.income.income_variability.value,
        },
        "expenses": {
            "period": context.expenses.period_expenses,
            "ytd": context.expenses.ytd_expenses,
            "average_monthly": context.expenses.average_monthly_expenses,
            "recurring": context.expenses.recurring_expenses,
        },
        "health_score": context.health_score,
        "alerts_count": len(context.alerts),
    }


@router.post("/forecast", response_model=dict)
async def generate_forecast(
    request: ForecastRequest,
    current_user: User = Depends(check_feature_access("forecasting")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Generate AI-powered cash flow forecast."""
    
    forecaster = CashFlowForecaster(engine, db)
    forecast = await forecaster.generate_forecast(
        context,
        num_months=request.months,
        include_scenarios=request.include_scenarios,
    )
    
    return forecast.to_dict()


@router.get("/forecasts", response_model=dict)
async def get_stored_forecasts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> Any:
    """Get previously generated forecasts."""
    
    forecasts = db.query(CashFlowForecast).filter(
        CashFlowForecast.user_id == current_user.id,
        CashFlowForecast.is_active == True,
    ).order_by(desc(CashFlowForecast.generated_at)).limit(limit).all()
    
    return {
        "forecasts": [f.to_dict() for f in forecasts],
    }


@router.get("/actuals", response_model=dict)
async def get_cash_flow_actuals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    months: int = Query(6, ge=1, le=24),
) -> Any:
    """Get historical actual cash flow data."""
    
    cutoff = date.today() - timedelta(days=months * 31)
    
    actuals = db.query(CashFlowActual).filter(
        CashFlowActual.user_id == current_user.id,
        CashFlowActual.period_date >= cutoff,
    ).order_by(CashFlowActual.period_date).all()
    
    return {
        "actuals": [a.to_dict() for a in actuals],
    }


@router.get("/recurring", response_model=dict)
async def get_recurring_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> Any:
    """Get all recurring transactions (subscriptions, bills, income)."""
    
    query = db.query(RecurringTransaction).filter(
        RecurringTransaction.user_id == current_user.id,
    )
    
    if not include_inactive:
        query = query.filter(RecurringTransaction.is_active == True)
    
    recurring = query.order_by(RecurringTransaction.next_expected_date).all()
    
    income = [r for r in recurring if r.is_income]
    expenses = [r for r in recurring if r.is_expense]
    
    total_monthly_income = sum(r.monthly_cost for r in income)
    total_monthly_expenses = sum(r.monthly_cost for r in expenses)
    
    return {
        "recurring": [r.to_dict() for r in recurring],
        "income": [r.to_dict() for r in income],
        "expenses": [r.to_dict() for r in expenses],
        "summary": {
            "total_monthly_income": total_monthly_income,
            "total_monthly_expenses": total_monthly_expenses,
            "net_monthly_recurring": total_monthly_income - total_monthly_expenses,
            "total_annual_expenses": sum(r.annual_cost for r in expenses),
        },
    }


@router.post("/recurring", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_recurring_transaction(
    recurring_data: RecurringCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new recurring transaction."""
    
    valid_frequencies = ["daily", "weekly", "biweekly", "monthly", "quarterly", "semi_annual", "annual"]
    if recurring_data.frequency not in valid_frequencies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid frequency. Use: {', '.join(valid_frequencies)}",
        )
    
    recurring = RecurringTransaction(
        user_id=current_user.id,
        name=recurring_data.name,
        merchant_name=recurring_data.merchant_name,
        amount=recurring_data.amount,
        frequency=recurring_data.frequency,
        is_income=recurring_data.is_income,
        is_expense=recurring_data.is_expense,
        is_essential=recurring_data.is_essential,
        category=recurring_data.category,
        next_expected_date=recurring_data.next_expected_date or date.today() + timedelta(days=30),
        notes=recurring_data.notes,
        is_confirmed=True,
        is_auto_detected=False,
    )
    
    db.add(recurring)
    db.commit()
    db.refresh(recurring)
    
    return recurring.to_dict()


@router.put("/recurring/{recurring_id}", response_model=dict)
async def update_recurring_transaction(
    recurring_id: UUID,
    recurring_data: RecurringUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update a recurring transaction."""
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.user_id == current_user.id,
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring transaction not found",
        )
    
    update_data = recurring_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(recurring, field, value)
    
    db.commit()
    db.refresh(recurring)
    
    return recurring.to_dict()


@router.delete("/recurring/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_transaction(
    recurring_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a recurring transaction."""
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.id == recurring_id,
        RecurringTransaction.user_id == current_user.id,
    ).first()
    
    if not recurring:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recurring transaction not found",
        )
    
    db.delete(recurring)
    db.commit()


@router.get("/subscriptions", response_model=dict)
async def get_subscriptions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get all subscriptions with analysis."""
    
    subscriptions = db.query(RecurringTransaction).filter(
        RecurringTransaction.user_id == current_user.id,
        RecurringTransaction.is_subscription == True,
        RecurringTransaction.is_active == True,
    ).order_by(desc(RecurringTransaction.amount)).all()
    
    total_monthly = sum(s.monthly_cost for s in subscriptions)
    total_annual = sum(s.annual_cost for s in subscriptions)
    
    by_category = {}
    for s in subscriptions:
        cat = s.category or "Uncategorized"
        if cat not in by_category:
            by_category[cat] = {"count": 0, "monthly": 0, "annual": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["monthly"] += s.monthly_cost
        by_category[cat]["annual"] += s.annual_cost
    
    return {
        "subscriptions": [s.to_dict() for s in subscriptions],
        "summary": {
            "total_count": len(subscriptions),
            "total_monthly": total_monthly,
            "total_annual": total_annual,
        },
        "by_category": by_category,
    }


@router.get("/runway", response_model=dict)
async def get_runway_analysis(
    current_user: User = Depends(get_current_user),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get detailed runway analysis."""
    
    balance = context.accounts.total_balance
    burn_rate = context.cash_flow.burn_rate
    
    runway = balance / burn_rate if burn_rate > 0 else 12
    
    scenarios = {
        "current": {
            "burn_rate": burn_rate,
            "runway_months": runway,
            "zero_date": str(date.today() + timedelta(days=int(runway * 30))) if runway < 24 else None,
        },
        "reduced_expenses_10": {
            "burn_rate": burn_rate * 0.9,
            "runway_months": balance / (burn_rate * 0.9) if burn_rate > 0 else 12,
        },
        "reduced_expenses_20": {
            "burn_rate": burn_rate * 0.8,
            "runway_months": balance / (burn_rate * 0.8) if burn_rate > 0 else 12,
        },
        "increased_income_10": {
            "effective_burn": burn_rate - (context.income.average_monthly_income * 0.1),
            "runway_months": balance / max(1, burn_rate - context.income.average_monthly_income * 0.1),
        },
    }
    
    targets = {
        "3_month_buffer": burn_rate * 3,
        "6_month_buffer": burn_rate * 6,
        "current_shortfall_3mo": max(0, burn_rate * 3 - balance),
        "current_shortfall_6mo": max(0, burn_rate * 6 - balance),
    }
    
    return {
        "current_balance": balance,
        "burn_rate": burn_rate,
        "runway_months": runway,
        "scenarios": scenarios,
        "targets": targets,
        "recommendation": "healthy" if runway >= 6 else "warning" if runway >= 3 else "critical",
    }


@router.get("/alerts", response_model=dict)
async def get_cash_flow_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get cash flow related alerts."""
    
    db_alerts = db.query(CashFlowAlert).filter(
        CashFlowAlert.user_id == current_user.id,
        CashFlowAlert.is_dismissed == False,
    ).order_by(desc(CashFlowAlert.created_at)).limit(20).all()
    
    cash_flow_alerts = [a for a in context.alerts if a.alert_type in ["cash_flow", "low_runway", "low_balance"]]
    
    return {
        "real_time": [a.to_dict() for a in cash_flow_alerts],
        "stored": [a.to_dict() for a in db_alerts],
    }
