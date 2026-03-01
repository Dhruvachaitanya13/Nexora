"""Tax schemas."""
from datetime import date
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from decimal import Decimal


class TaxCalculationRequest(BaseModel):
    gross_income: float = Field(..., ge=0)
    business_expenses: float = Field(..., ge=0)
    other_deductions: float = Field(default=0, ge=0)
    filing_status: str = "single"
    use_itemized: bool = False
    itemized_deductions: float = Field(default=0, ge=0)


class TaxCalculationResponse(BaseModel):
    summary: Dict[str, Any]
    federal: Dict[str, Any]
    state: Dict[str, Any]
    self_employment: Dict[str, Any]
    total: Dict[str, Any]


class TaxReserveRequest(BaseModel):
    income_amount: float = Field(..., gt=0)
    ytd_income: float = Field(default=0, ge=0)


class TaxReserveResponse(BaseModel):
    income_amount: float
    federal_reserve: float
    state_reserve: float
    se_reserve: float
    total_reserve: float
    reserve_percentage: float


class QuarterlyPaymentResponse(BaseModel):
    quarter: int
    tax_year: int
    period_start: date
    period_end: date
    federal_due_date: date
    state_due_date: date
    federal_amount_due: float
    state_amount_due: float
    total_due: float
    status: str


class DeductionSummary(BaseModel):
    category: str
    amount: float
    transaction_count: int
    schedule_c_line: Optional[str] = None
