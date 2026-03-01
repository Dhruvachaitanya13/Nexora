from datetime import datetime, date
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.income_source import IncomeSource, IncomeType
from app.models.transaction import Transaction

router = APIRouter()


class IncomeSourceCreate(BaseModel):
    name: str
    income_type: str
    client_id: Optional[UUID] = None
    description: Optional[str] = None
    expected_amount: Optional[float] = None
    frequency: Optional[str] = None
    is_recurring: bool = False
    is_1099: bool = True
    tax_category: Optional[str] = None
    notes: Optional[str] = None


class IncomeSourceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    expected_amount: Optional[float] = None
    frequency: Optional[str] = None
    is_recurring: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


@router.get("", response_model=dict)
async def get_income_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = False,
) -> Any:
    """Get all income sources."""
    
    query = db.query(IncomeSource).filter(
        IncomeSource.user_id == current_user.id,
    )
    
    if not include_inactive:
        query = query.filter(IncomeSource.is_active == True)
    
    sources = query.order_by(IncomeSource.name).all()
    
    year_start = date(date.today().year, 1, 1)
    
    result = []
    for source in sources:
        ytd_income = db.query(func.sum(func.abs(Transaction.amount))).filter(
            Transaction.user_id == current_user.id,
            Transaction.is_income == True,
            Transaction.merchant_name.ilike(f"%{source.name}%"),
            Transaction.transaction_date >= year_start,
        ).scalar() or 0
        
        result.append({
            "id": str(source.id),
            "name": source.name,
            "type": source.income_type.value if source.income_type else None,
            "client_id": str(source.client_id) if source.client_id else None,
            "expected_amount": source.expected_amount,
            "frequency": source.frequency,
            "is_recurring": source.is_recurring,
            "is_1099": source.is_1099,
            "is_active": source.is_active,
            "ytd_income": ytd_income,
        })
    
    return {
        "income_sources": result,
        "total_ytd": sum(s["ytd_income"] for s in result),
    }


@router.get("/{source_id}", response_model=dict)
async def get_income_source(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get income source details."""
    
    source = db.query(IncomeSource).filter(
        IncomeSource.id == source_id,
        IncomeSource.user_id == current_user.id,
    ).first()
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Income source not found",
        )
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == True,
        Transaction.merchant_name.ilike(f"%{source.name}%"),
    ).order_by(desc(Transaction.transaction_date)).limit(20).all()
    
    return {
        "income_source": {
            "id": str(source.id),
            "name": source.name,
            "type": source.income_type.value if source.income_type else None,
            "description": source.description,
            "expected_amount": source.expected_amount,
            "frequency": source.frequency,
            "is_recurring": source.is_recurring,
            "is_1099": source.is_1099,
            "tax_category": source.tax_category,
            "notes": source.notes,
            "is_active": source.is_active,
        },
        "recent_payments": [
            {
                "id": str(t.id),
                "amount": abs(t.amount),
                "date": str(t.transaction_date),
                "description": t.description,
            }
            for t in transactions
        ],
        "statistics": {
            "total_received": sum(abs(t.amount) for t in transactions),
            "payment_count": len(transactions),
            "average_payment": sum(abs(t.amount) for t in transactions) / len(transactions) if transactions else 0,
        },
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_income_source(
    source_data: IncomeSourceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new income source."""
    
    try:
        income_type = IncomeType(source_data.income_type)
    except ValueError:
        income_type = IncomeType.FREELANCE
    
    source = IncomeSource(
        user_id=current_user.id,
        name=source_data.name,
        income_type=income_type,
        client_id=source_data.client_id,
        description=source_data.description,
        expected_amount=source_data.expected_amount,
        frequency=source_data.frequency,
        is_recurring=source_data.is_recurring,
        is_1099=source_data.is_1099,
        tax_category=source_data.tax_category,
        notes=source_data.notes,
    )
    
    db.add(source)
    db.commit()
    db.refresh(source)
    
    return {
        "id": str(source.id),
        "name": source.name,
        "message": "Income source created",
    }


@router.put("/{source_id}", response_model=dict)
async def update_income_source(
    source_id: UUID,
    source_data: IncomeSourceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update an income source."""
    
    source = db.query(IncomeSource).filter(
        IncomeSource.id == source_id,
        IncomeSource.user_id == current_user.id,
    ).first()
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Income source not found",
        )
    
    update_data = source_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(source, field, value)
    
    db.commit()
    db.refresh(source)
    
    return {"id": str(source.id), "message": "Income source updated"}


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income_source(
    source_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete an income source."""
    
    source = db.query(IncomeSource).filter(
        IncomeSource.id == source_id,
        IncomeSource.user_id == current_user.id,
    ).first()
    
    if not source:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Income source not found",
        )
    
    source.is_active = False
    db.commit()


@router.get("/types/list", response_model=dict)
async def list_income_types() -> Any:
    """Get available income types."""
    
    return {
        "types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in IncomeType
        ],
    }
