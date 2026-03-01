"""Analytics endpoints."""
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from decimal import Decimal

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard data."""
    today = date.today()
    month_start = today.replace(day=1)
    year_start = date(today.year, 1, 1)
    
    # Accounts
    acc_result = await db.execute(
        select(ConnectedAccount).where(
            ConnectedAccount.user_id == current_user.id,
            ConnectedAccount.is_active == True,
        )
    )
    accounts = acc_result.scalars().all()
    total_balance = sum(float(a.current_balance or 0) for a in accounts if a.account_type == "depository")
    
    # This month
    month_result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= month_start,
            Transaction.is_excluded == False,
        )
    )
    month_txns = month_result.scalars().all()
    month_income = sum(float(t.amount) for t in month_txns if t.is_income)
    month_expenses = sum(float(t.amount) for t in month_txns if not t.is_income)
    
    # YTD
    ytd_result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= year_start,
            Transaction.is_excluded == False,
        )
    )
    ytd_txns = ytd_result.scalars().all()
    ytd_income = sum(float(t.amount) for t in ytd_txns if t.is_income)
    ytd_expenses = sum(float(t.amount) for t in ytd_txns if not t.is_income)
    ytd_business = sum(float(t.amount) for t in ytd_txns if t.is_business_expense)
    
    # Recent
    recent = sorted(month_txns, key=lambda x: x.transaction_date, reverse=True)[:10]
    
    return {
        "accounts": {
            "total_balance": total_balance,
            "count": len(accounts),
        },
        "this_month": {
            "income": month_income,
            "expenses": month_expenses,
            "net": month_income - month_expenses,
        },
        "year_to_date": {
            "income": ytd_income,
            "expenses": ytd_expenses,
            "net": ytd_income - ytd_expenses,
            "business_expenses": ytd_business,
        },
        "recent_transactions": [
            {
                "id": str(t.id),
                "date": t.transaction_date,
                "merchant": t.merchant_name,
                "amount": float(t.amount),
                "is_income": t.is_income,
            }
            for t in recent
        ],
    }


@router.get("/income/trends")
async def income_trends(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get income trends."""
    end_date = date.today()
    start_date = end_date - timedelta(days=months * 30)
    
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.is_income == True,
            Transaction.transaction_date >= start_date,
        )
    )
    transactions = result.scalars().all()
    
    monthly = {}
    for t in transactions:
        key = t.transaction_date.strftime("%Y-%m")
        monthly[key] = monthly.get(key, 0) + float(t.amount)
    
    return {
        "monthly": [{"month": k, "amount": v} for k, v in sorted(monthly.items())],
        "total": sum(monthly.values()),
        "average": sum(monthly.values()) / len(monthly) if monthly else 0,
    }


@router.get("/spending/by-category")
async def spending_by_category(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get spending by category."""
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    result = await db.execute(
        select(Transaction).where(
            Transaction.user_id == current_user.id,
            Transaction.is_income == False,
            Transaction.transaction_date >= start_date,
            Transaction.transaction_date <= end_date,
        )
    )
    transactions = result.scalars().all()
    
    by_cat = {}
    for t in transactions:
        cat = t.plaid_category.split(",")[0].strip() if t.plaid_category else "Uncategorized"
        by_cat[cat] = by_cat.get(cat, 0) + float(t.amount)
    
    total = sum(by_cat.values())
    
    return {
        "total": total,
        "categories": [
            {"category": k, "amount": v, "percentage": (v/total*100) if total else 0}
            for k, v in sorted(by_cat.items(), key=lambda x: x[1], reverse=True)
        ],
    }
