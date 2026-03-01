from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
from pydantic import BaseModel

from app.api.deps import (
    get_db, get_current_user, get_financial_context, get_agent_orchestrator
)
from app.models.user import User
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.invoice import Invoice, InvoiceStatus
from app.models.goal import Goal
from app.models.cashflow import CashFlowAlert
from app.services.ai.context import FinancialContext
from app.services.ai.agent_orchestrator import AgentOrchestrator

router = APIRouter()


@router.get("/overview", response_model=dict)
async def get_dashboard_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get comprehensive dashboard overview with all key metrics."""
    
    return {
        "user": {
            "name": current_user.display_name_or_email,
            "business_type": current_user.business_type.value if current_user.business_type else None,
            "subscription_tier": current_user.subscription_tier.value,
            "onboarding_completed": current_user.onboarding_completed,
        },
        "financial_health": {
            "score": context.health_score,
            "status": context.financial_health.value,
            "factors": context.health_factors,
        },
        "balances": {
            "total": context.accounts.total_balance,
            "available": context.accounts.available_balance,
            "checking": context.accounts.checking_balance,
            "savings": context.accounts.savings_balance,
            "credit_used": abs(context.accounts.credit_balance),
            "credit_limit": context.accounts.credit_limit,
            "credit_utilization": context.accounts.credit_utilization,
        },
        "period_summary": {
            "start": str(context.period_start),
            "end": str(context.period_end),
            "income": context.income.period_income,
            "expenses": context.expenses.period_expenses,
            "net": context.income.period_income - context.expenses.period_expenses,
            "savings_rate": context.cash_flow.savings_rate,
        },
        "ytd_summary": {
            "income": context.income.ytd_income,
            "expenses": context.expenses.ytd_expenses,
            "net": context.income.ytd_income - context.expenses.ytd_expenses,
            "business_expenses": context.expenses.business_expenses,
            "tax_deductible": context.expenses.tax_deductible,
        },
        "cash_flow": {
            "runway_months": context.cash_flow.current_runway_months,
            "burn_rate": context.cash_flow.burn_rate,
            "trend": context.cash_flow.cash_flow_trend,
            "projected_30d": context.cash_flow.projected_balance_30d,
            "projected_60d": context.cash_flow.projected_balance_60d,
            "projected_90d": context.cash_flow.projected_balance_90d,
        },
        "tax": {
            "estimated_annual": context.tax.estimated_annual_tax,
            "effective_rate": context.tax.effective_tax_rate,
            "next_deadline": str(context.tax.next_deadline) if context.tax.next_deadline else None,
            "days_until_deadline": context.tax.days_until_deadline,
            "quarterly_due": context.tax.quarterly_payment_due,
            "reserve_current": context.tax.tax_reserve_current,
            "reserve_target": context.tax.tax_reserve_target,
            "reserve_shortfall": context.tax.tax_reserve_shortfall,
        },
        "invoices": {
            "outstanding": context.invoices.total_outstanding,
            "outstanding_count": context.invoices.invoice_count_outstanding,
            "overdue": context.invoices.total_overdue,
            "overdue_count": context.invoices.invoice_count_overdue,
            "avg_days_to_payment": context.invoices.average_days_to_payment,
            "collection_rate": context.invoices.collection_rate,
        },
        "goals": {
            "active": context.goals.active_goals,
            "on_track": context.goals.goals_on_track,
            "behind": context.goals.goals_behind,
            "overall_progress": context.goals.overall_progress,
        },
        "data_quality": {
            "uncategorized_count": context.data_quality.uncategorized_count,
            "uncategorized_amount": context.data_quality.uncategorized_amount,
            "categorization_rate": context.data_quality.categorization_rate,
            "missing_receipts": context.data_quality.missing_receipts,
        },
        "alerts": [a.to_dict() for a in context.alerts[:5]],
        "alerts_count": len(context.alerts),
    }


@router.get("/quick-stats", response_model=dict)
async def get_quick_stats(
    current_user: User = Depends(get_current_user),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get minimal quick stats for header/navbar display."""
    
    return {
        "balance": context.accounts.total_balance,
        "health_score": context.health_score,
        "runway_months": context.cash_flow.current_runway_months,
        "alerts_count": len([a for a in context.alerts if a.severity.value in ["critical", "urgent"]]),
        "uncategorized": context.data_quality.uncategorized_count,
    }


@router.get("/income-expenses", response_model=dict)
async def get_income_expenses_chart(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    months: int = Query(6, ge=1, le=24),
) -> Any:
    """Get income vs expenses data for charts."""
    
    cutoff = date.today() - timedelta(days=months * 31)
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= cutoff,
        Transaction.is_deleted == False,
    ).all()
    
    monthly_data = {}
    for t in transactions:
        month = t.transaction_date.strftime("%Y-%m")
        if month not in monthly_data:
            monthly_data[month] = {"income": 0, "expenses": 0, "business": 0, "net": 0}
        
        if t.is_income:
            monthly_data[month]["income"] += abs(t.amount)
        elif not t.is_transfer:
            monthly_data[month]["expenses"] += abs(t.amount)
            if t.is_business_expense:
                monthly_data[month]["business"] += abs(t.amount)
    
    for month in monthly_data:
        monthly_data[month]["net"] = monthly_data[month]["income"] - monthly_data[month]["expenses"]
    
    chart_data = [
        {
            "month": month,
            "income": data["income"],
            "expenses": data["expenses"],
            "business_expenses": data["business"],
            "net": data["net"],
        }
        for month, data in sorted(monthly_data.items())
    ]
    
    return {
        "data": chart_data,
        "summary": {
            "total_income": sum(d["income"] for d in chart_data),
            "total_expenses": sum(d["expenses"] for d in chart_data),
            "avg_monthly_income": sum(d["income"] for d in chart_data) / max(1, len(chart_data)),
            "avg_monthly_expenses": sum(d["expenses"] for d in chart_data) / max(1, len(chart_data)),
        }
    }


@router.get("/expenses-by-category", response_model=dict)
async def get_expenses_by_category(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Get expense breakdown by category for pie/donut charts."""
    
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_income == False,
        Transaction.is_transfer == False,
        Transaction.is_deleted == False,
    ).all()
    
    by_category = {}
    for t in transactions:
        category = t.category_display
        if category not in by_category:
            by_category[category] = {"amount": 0, "count": 0, "is_business": False}
        by_category[category]["amount"] += abs(t.amount)
        by_category[category]["count"] += 1
        if t.is_business_expense:
            by_category[category]["is_business"] = True
    
    total = sum(d["amount"] for d in by_category.values())
    
    categories = [
        {
            "category": cat,
            "amount": data["amount"],
            "percentage": (data["amount"] / total * 100) if total > 0 else 0,
            "count": data["count"],
            "is_business": data["is_business"],
        }
        for cat, data in sorted(by_category.items(), key=lambda x: -x[1]["amount"])
    ]
    
    return {
        "period": {"start": str(start_date), "end": str(end_date)},
        "total": total,
        "categories": categories,
    }


@router.get("/recent-transactions", response_model=dict)
async def get_recent_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
) -> Any:
    """Get recent transactions for dashboard display."""
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_deleted == False,
        Transaction.is_hidden == False,
    ).order_by(desc(Transaction.transaction_date), desc(Transaction.created_at)).limit(limit).all()
    
    return {
        "transactions": [t.to_summary_dict() for t in transactions],
    }


@router.get("/upcoming-bills", response_model=dict)
async def get_upcoming_bills(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=7, le=90),
) -> Any:
    """Get upcoming recurring bills and expenses."""
    
    from app.models.cashflow import RecurringTransaction
    
    today = date.today()
    end_date = today + timedelta(days=days)
    
    recurring = db.query(RecurringTransaction).filter(
        RecurringTransaction.user_id == current_user.id,
        RecurringTransaction.is_active == True,
        RecurringTransaction.is_expense == True,
        RecurringTransaction.next_expected_date >= today,
        RecurringTransaction.next_expected_date <= end_date,
    ).order_by(RecurringTransaction.next_expected_date).all()
    
    bills = [
        {
            "id": str(r.id),
            "name": r.name,
            "merchant": r.merchant_name,
            "amount": abs(r.amount),
            "due_date": str(r.next_expected_date),
            "days_until": (r.next_expected_date - today).days,
            "frequency": r.frequency,
            "is_essential": r.is_essential,
            "category": r.category,
        }
        for r in recurring
    ]
    
    total_upcoming = sum(b["amount"] for b in bills)
    
    return {
        "bills": bills,
        "total": total_upcoming,
        "count": len(bills),
    }


@router.get("/income-sources", response_model=dict)
async def get_income_sources_breakdown(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    months: int = Query(3, ge=1, le=12),
) -> Any:
    """Get income breakdown by source/client."""
    
    cutoff = date.today() - timedelta(days=months * 31)
    
    income_txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == True,
        Transaction.transaction_date >= cutoff,
        Transaction.is_deleted == False,
    ).all()
    
    by_source = {}
    for t in income_txns:
        source = t.merchant_name or t.name or "Other"
        if source not in by_source:
            by_source[source] = {"amount": 0, "count": 0, "last_date": None}
        by_source[source]["amount"] += abs(t.amount)
        by_source[source]["count"] += 1
        if not by_source[source]["last_date"] or t.transaction_date > by_source[source]["last_date"]:
            by_source[source]["last_date"] = t.transaction_date
    
    total = sum(d["amount"] for d in by_source.values())
    
    sources = [
        {
            "source": src,
            "amount": data["amount"],
            "percentage": (data["amount"] / total * 100) if total > 0 else 0,
            "count": data["count"],
            "last_payment": str(data["last_date"]) if data["last_date"] else None,
        }
        for src, data in sorted(by_source.items(), key=lambda x: -x[1]["amount"])[:10]
    ]
    
    return {
        "period_months": months,
        "total": total,
        "sources": sources,
    }


@router.get("/goals-progress", response_model=dict)
async def get_goals_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get active goals with progress."""
    
    goals = db.query(Goal).filter(
        Goal.user_id == current_user.id,
        Goal.status.in_(["not_started", "in_progress", "on_track", "behind"]),
    ).order_by(Goal.target_date).all()
    
    goal_data = []
    for g in goals:
        goal_data.append({
            "id": str(g.id),
            "name": g.name,
            "type": g.goal_type.value,
            "target": g.target_amount,
            "current": g.current_amount,
            "progress": g.progress_percentage,
            "target_date": str(g.target_date) if g.target_date else None,
            "days_remaining": g.days_remaining,
            "status": g.status.value,
            "is_on_track": g.status.value in ["on_track", "completed"],
        })
    
    return {
        "goals": goal_data,
        "summary": {
            "total_target": sum(g["target"] for g in goal_data),
            "total_current": sum(g["current"] for g in goal_data),
            "on_track": len([g for g in goal_data if g["is_on_track"]]),
            "behind": len([g for g in goal_data if not g["is_on_track"]]),
        }
    }


@router.get("/alerts", response_model=dict)
async def get_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
    include_dismissed: bool = False,
) -> Any:
    """Get all active alerts."""
    
    db_alerts = db.query(CashFlowAlert).filter(
        CashFlowAlert.user_id == current_user.id,
        CashFlowAlert.is_dismissed == False if not include_dismissed else True,
    ).order_by(desc(CashFlowAlert.created_at)).limit(20).all()
    
    context_alerts = [a.to_dict() for a in context.alerts]
    stored_alerts = [a.to_dict() for a in db_alerts]
    
    return {
        "real_time_alerts": context_alerts,
        "stored_alerts": stored_alerts,
        "total_count": len(context_alerts) + len(stored_alerts),
        "critical_count": len([a for a in context.alerts if a.severity.value == "critical"]),
        "urgent_count": len([a for a in context.alerts if a.severity.value == "urgent"]),
    }


@router.post("/alerts/{alert_id}/dismiss", response_model=dict)
async def dismiss_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Dismiss an alert."""
    
    alert = db.query(CashFlowAlert).filter(
        CashFlowAlert.id == alert_id,
        CashFlowAlert.user_id == current_user.id,
    ).first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )
    
    alert.dismiss()
    db.commit()
    
    return {"message": "Alert dismissed"}


@router.get("/ai-summary", response_model=dict)
async def get_ai_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orchestrator: AgentOrchestrator = Depends(get_agent_orchestrator),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get AI-generated dashboard insights summary."""
    
    insights = await orchestrator.get_dashboard_insights(context)
    return insights
