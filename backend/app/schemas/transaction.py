"""Transaction schemas."""
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from uuid import UUID


class TransactionBase(BaseModel):
    amount: float
    transaction_date: date
    merchant_name: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = []


class TransactionCreate(TransactionBase):
    account_id: UUID
    category_id: Optional[int] = None
    is_business_expense: bool = False
    is_tax_deductible: bool = False


class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    is_business_expense: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    tax_category: Optional[str] = None
    business_percentage: Optional[float] = Field(None, ge=0, le=100)
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
    is_excluded: Optional[bool] = None


class TransactionResponse(TransactionBase):
    id: UUID
    account_id: UUID
    plaid_transaction_id: Optional[str] = None
    transaction_type: Optional[str] = None
    payment_channel: Optional[str] = None
    original_description: Optional[str] = None
    merchant_city: Optional[str] = None
    merchant_state: Optional[str] = None
    plaid_category: Optional[str] = None
    final_category_id: Optional[int] = None
    is_business_expense: bool = False
    is_tax_deductible: bool = False
    tax_category: Optional[str] = None
    is_income: bool = False
    is_recurring: bool = False
    is_pending: bool = False
    is_anomaly: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionSummary(BaseModel):
    period_start: date
    period_end: date
    total_income: float
    total_expenses: float
    net_cash_flow: float
    business_expenses: float
    tax_deductible_expenses: float
    transaction_count: int
    top_categories: List[dict]
    top_merchants: List[dict]


class TransactionFilters(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    account_ids: Optional[List[UUID]] = None
    category_ids: Optional[List[int]] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    is_income: Optional[bool] = None
    is_business_expense: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    merchant_name: Optional[str] = None
    tags: Optional[List[str]] = None
