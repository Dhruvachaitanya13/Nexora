from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user, get_financial_context
from app.models.user import User
from app.models.account import Account, AccountType, AccountSubtype, AccountSyncStatus
from app.models.transaction import Transaction
from app.services.ai.context import FinancialContext

router = APIRouter()


class AccountCreate(BaseModel):
    account_name: str
    account_type: str
    account_subtype: Optional[str] = None
    current_balance: float = 0.0
    available_balance: Optional[float] = None
    credit_limit: Optional[float] = None
    institution_name: Optional[str] = None
    mask: Optional[str] = None
    currency: str = "USD"
    notes: Optional[str] = None
    is_business: bool = False
    purpose: Optional[str] = None


class AccountUpdate(BaseModel):
    nickname: Optional[str] = None
    is_hidden: Optional[bool] = None
    is_primary: Optional[bool] = None
    is_business: Optional[bool] = None
    purpose: Optional[str] = None
    budget_amount: Optional[float] = None
    target_balance: Optional[float] = None
    low_balance_alert_threshold: Optional[float] = None
    notes: Optional[str] = None


class ManualBalanceUpdate(BaseModel):
    current_balance: float
    available_balance: Optional[float] = None
    as_of_date: Optional[date] = None


@router.get("", response_model=dict)
async def get_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_hidden: bool = False,
    account_type: Optional[str] = None,
) -> Any:
    """Get all connected accounts."""
    
    query = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_active == True,
    )
    
    if not include_hidden:
        query = query.filter(Account.is_hidden == False)
    
    if account_type:
        try:
            type_enum = AccountType(account_type)
            query = query.filter(Account.account_type == type_enum)
        except ValueError:
            pass
    
    accounts = query.order_by(Account.institution_name, Account.account_name).all()
    
    total_balance = sum(a.current_balance or 0 for a in accounts if a.account_type != AccountType.CREDIT)
    total_credit = sum(abs(a.current_balance or 0) for a in accounts if a.account_type == AccountType.CREDIT)
    total_credit_limit = sum(a.credit_limit or 0 for a in accounts if a.account_type == AccountType.CREDIT)
    
    return {
        "accounts": [a.to_summary_dict() for a in accounts],
        "summary": {
            "total_balance": total_balance,
            "total_available": sum(a.available_balance or a.current_balance or 0 for a in accounts if a.account_type != AccountType.CREDIT),
            "total_credit_used": total_credit,
            "total_credit_limit": total_credit_limit,
            "credit_utilization": (total_credit / total_credit_limit * 100) if total_credit_limit > 0 else 0,
            "account_count": len(accounts),
        },
        "by_type": {
            "checking": sum(a.current_balance or 0 for a in accounts if a.account_subtype and "checking" in a.account_subtype.value.lower()),
            "savings": sum(a.current_balance or 0 for a in accounts if a.account_subtype and "savings" in a.account_subtype.value.lower()),
            "credit": total_credit,
            "investment": sum(a.current_balance or 0 for a in accounts if a.account_type == AccountType.INVESTMENT),
        },
    }


@router.get("/summary", response_model=dict)
async def get_accounts_summary(
    current_user: User = Depends(get_current_user),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get account balances summary."""
    
    return {
        "total_balance": context.accounts.total_balance,
        "available_balance": context.accounts.available_balance,
        "checking_balance": context.accounts.checking_balance,
        "savings_balance": context.accounts.savings_balance,
        "credit_balance": context.accounts.credit_balance,
        "credit_limit": context.accounts.credit_limit,
        "credit_utilization": context.accounts.credit_utilization,
        "investment_balance": context.accounts.investment_balance,
        "account_count": context.accounts.account_count,
    }


@router.get("/{account_id}", response_model=dict)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get account details."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    recent_txns = db.query(Transaction).filter(
        Transaction.account_id == account_id,
    ).order_by(desc(Transaction.transaction_date)).limit(10).all()
    
    result = account.to_full_dict()
    result["recent_transactions"] = [t.to_summary_dict() for t in recent_txns]
    
    return result


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_manual_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a manual account (not connected via Plaid)."""
    
    try:
        account_type = AccountType(account_data.account_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid account type. Valid types: {[t.value for t in AccountType]}",
        )
    
    account_subtype = None
    if account_data.account_subtype:
        try:
            account_subtype = AccountSubtype(account_data.account_subtype)
        except ValueError:
            pass
    
    account = Account(
        user_id=current_user.id,
        account_name=account_data.account_name,
        account_type=account_type,
        account_subtype=account_subtype,
        current_balance=account_data.current_balance,
        available_balance=account_data.available_balance or account_data.current_balance,
        credit_limit=account_data.credit_limit,
        institution_name=account_data.institution_name,
        mask=account_data.mask,
        currency=account_data.currency,
        notes=account_data.notes,
        is_manual=True,
        is_business=account_data.is_business,
        purpose=account_data.purpose,
        sync_status=AccountSyncStatus.SYNCED,
    )
    
    db.add(account)
    db.commit()
    db.refresh(account)
    
    return account.to_full_dict()


@router.put("/{account_id}", response_model=dict)
async def update_account(
    account_id: UUID,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update account settings."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    update_data = account_data.dict(exclude_unset=True)
    
    if update_data.get("is_primary"):
        db.query(Account).filter(
            Account.user_id == current_user.id,
            Account.id != account_id,
        ).update({"is_primary": False})
    
    for field, value in update_data.items():
        setattr(account, field, value)
    
    db.commit()
    db.refresh(account)
    
    return account.to_full_dict()


@router.put("/{account_id}/balance", response_model=dict)
async def update_manual_balance(
    account_id: UUID,
    balance_data: ManualBalanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update balance for manual account."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    if not account.is_manual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot manually update balance for connected accounts",
        )
    
    account.update_balance(
        current=balance_data.current_balance,
        available=balance_data.available_balance,
    )
    
    db.commit()
    db.refresh(account)
    
    return account.to_full_dict()


@router.get("/{account_id}/transactions", response_model=dict)
async def get_account_transactions(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Get transactions for a specific account."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    query = db.query(Transaction).filter(
        Transaction.account_id == account_id,
        Transaction.is_deleted == False,
    )
    
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)
    
    total = query.count()
    transactions = query.order_by(desc(Transaction.transaction_date)).offset(skip).limit(limit).all()
    
    return {
        "account": account.to_summary_dict(),
        "transactions": [t.to_summary_dict() for t in transactions],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/{account_id}/sync", response_model=dict)
async def sync_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Trigger sync for a connected account."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    if account.is_manual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sync manual accounts",
        )
    
    if not account.plaid_item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account not connected to Plaid",
        )
    
    return {
        "message": "Sync initiated",
        "account_id": str(account_id),
    }


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete/disconnect an account."""
    
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.user_id == current_user.id,
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found",
        )
    
    account.is_active = False
    account.is_hidden = True
    db.commit()
