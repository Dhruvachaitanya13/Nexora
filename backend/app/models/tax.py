from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base


class FilingStatus(str, enum.Enum):
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    QUALIFYING_WIDOW = "qualifying_widow"


class TaxYear(str, enum.Enum):
    Y2023 = "2023"
    Y2024 = "2024"
    Y2025 = "2025"


class Quarter(str, enum.Enum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"


class DeductionType(str, enum.Enum):
    BUSINESS_EXPENSE = "business_expense"
    HOME_OFFICE = "home_office"
    VEHICLE = "vehicle"
    HEALTH_INSURANCE = "health_insurance"
    RETIREMENT = "retirement"
    DEPRECIATION = "depreciation"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    WAIVED = "waived"


class TaxEstimate(Base):
    __tablename__ = "tax_estimates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    tax_year = Column(String(4), nullable=False)
    quarter = Column(Enum(Quarter), nullable=True)
    filing_status = Column(Enum(FilingStatus), default=FilingStatus.SINGLE, nullable=False)
    
    calculation_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    
    gross_income = Column(Float, default=0.0, nullable=False)
    business_income = Column(Float, default=0.0)
    w2_income = Column(Float, default=0.0)
    other_income = Column(Float, default=0.0)
    
    total_deductions = Column(Float, default=0.0, nullable=False)
    standard_deduction = Column(Float, default=0.0)
    itemized_deductions = Column(Float, default=0.0)
    business_deductions = Column(Float, default=0.0)
    qbi_deduction = Column(Float, default=0.0)
    retirement_deduction = Column(Float, default=0.0)
    health_insurance_deduction = Column(Float, default=0.0)
    se_tax_deduction = Column(Float, default=0.0)
    
    taxable_income = Column(Float, default=0.0, nullable=False)
    
    federal_tax = Column(Float, default=0.0, nullable=False)
    federal_tax_rate = Column(Float, nullable=True)
    federal_marginal_rate = Column(Float, nullable=True)
    
    state_tax = Column(Float, default=0.0, nullable=False)
    state_tax_rate = Column(Float, nullable=True)
    state = Column(String(2), default="IL")
    
    local_tax = Column(Float, default=0.0)
    
    self_employment_tax = Column(Float, default=0.0, nullable=False)
    se_tax_rate = Column(Float, default=0.153)
    social_security_tax = Column(Float, default=0.0)
    medicare_tax = Column(Float, default=0.0)
    additional_medicare_tax = Column(Float, default=0.0)
    
    total_tax = Column(Float, default=0.0, nullable=False)
    effective_tax_rate = Column(Float, nullable=True)
    
    credits = Column(JSONB, default=dict)
    total_credits = Column(Float, default=0.0)
    
    estimated_payments_made = Column(Float, default=0.0)
    withholdings = Column(Float, default=0.0)
    tax_due = Column(Float, default=0.0)
    refund_expected = Column(Float, default=0.0)
    
    quarterly_payment_required = Column(Float, default=0.0)
    safe_harbor_amount = Column(Float, nullable=True)
    
    annualized_income = Column(Float, nullable=True)
    annualized_tax = Column(Float, nullable=True)
    
    income_breakdown = Column(JSONB, default=dict)
    deduction_breakdown = Column(JSONB, default=dict)
    tax_breakdown = Column(JSONB, default=dict)
    
    assumptions = Column(JSONB, default=dict)
    warnings = Column(JSONB, default=list)
    recommendations = Column(JSONB, default=list)
    
    scenario_name = Column(String(100), default="current")
    is_primary = Column(Boolean, default=True)
    
    accuracy_score = Column(Float, nullable=True)
    actual_tax = Column(Float, nullable=True)
    variance = Column(Float, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="tax_estimates")
    
    __table_args__ = (
        Index("ix_tax_estimates_user_year", "user_id", "tax_year"),
        Index("ix_tax_estimates_user_quarter", "user_id", "tax_year", "quarter"),
    )
    
    @hybrid_property
    def net_income(self) -> float:
        return self.gross_income - self.total_tax
    
    @hybrid_property
    def take_home_rate(self) -> float:
        if self.gross_income <= 0:
            return 0.0
        return (self.net_income / self.gross_income) * 100
    
    @hybrid_property
    def needs_estimated_payment(self) -> bool:
        return self.tax_due > 1000
    
    def calculate_effective_rate(self) -> None:
        if self.gross_income > 0:
            self.effective_tax_rate = (self.total_tax / self.gross_income) * 100
    
    def add_warning(self, warning_type: str, message: str, severity: str = "warning") -> None:
        if not self.warnings:
            self.warnings = []
        self.warnings.append({
            "type": warning_type,
            "message": message,
            "severity": severity,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def add_recommendation(self, title: str, description: str, potential_savings: float = None) -> None:
        if not self.recommendations:
            self.recommendations = []
        self.recommendations.append({
            "title": title,
            "description": description,
            "potential_savings": potential_savings,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "tax_year": self.tax_year,
            "quarter": self.quarter.value if self.quarter else None,
            "gross_income": self.gross_income,
            "total_deductions": self.total_deductions,
            "taxable_income": self.taxable_income,
            "federal_tax": self.federal_tax,
            "state_tax": self.state_tax,
            "self_employment_tax": self.self_employment_tax,
            "total_tax": self.total_tax,
            "effective_tax_rate": self.effective_tax_rate,
            "tax_due": self.tax_due,
            "quarterly_payment_required": self.quarterly_payment_required,
            "recommendations": self.recommendations,
            "calculated_at": self.calculation_date.isoformat() if self.calculation_date else None,
        }


class TaxPayment(Base):
    __tablename__ = "tax_payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    tax_year = Column(String(4), nullable=False)
    quarter = Column(Enum(Quarter), nullable=True)
    payment_type = Column(String(50), default="estimated")
    
    amount_due = Column(Float, nullable=False)
    amount_paid = Column(Float, default=0.0)
    amount_remaining = Column(Float, default=0.0)
    
    due_date = Column(Date, nullable=False)
    paid_date = Column(Date, nullable=True)
    
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, nullable=False)
    
    payment_method = Column(String(50), nullable=True)
    confirmation_number = Column(String(100), nullable=True)
    
    federal_amount = Column(Float, default=0.0)
    state_amount = Column(Float, default=0.0)
    local_amount = Column(Float, default=0.0)
    
    penalty_amount = Column(Float, default=0.0)
    interest_amount = Column(Float, default=0.0)
    
    notes = Column(Text, nullable=True)
    receipt_url = Column(String(500), nullable=True)
    
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="tax_payments")
    
    __table_args__ = (
        Index("ix_tax_payments_user_year", "user_id", "tax_year"),
        Index("ix_tax_payments_due_date", "due_date", "status"),
    )
    
    @hybrid_property
    def is_overdue(self) -> bool:
        if self.status == PaymentStatus.PAID:
            return False
        return date.today() > self.due_date
    
    @hybrid_property
    def days_until_due(self) -> int:
        return (self.due_date - date.today()).days
    
    @hybrid_property
    def days_overdue(self) -> int:
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days
    
    def record_payment(self, amount: float, payment_date: date = None, method: str = None, confirmation: str = None) -> None:
        self.amount_paid += amount
        self.amount_remaining = max(0, self.amount_due - self.amount_paid)
        self.paid_date = payment_date or date.today()
        
        if method:
            self.payment_method = method
        if confirmation:
            self.confirmation_number = confirmation
        
        if self.amount_remaining <= 0:
            self.status = PaymentStatus.PAID
        else:
            self.status = PaymentStatus.PARTIAL
    
    def calculate_penalty(self, annual_rate: float = 0.08) -> float:
        if not self.is_overdue:
            return 0.0
        days = self.days_overdue
        daily_rate = annual_rate / 365
        self.penalty_amount = self.amount_remaining * daily_rate * days
        return self.penalty_amount
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "tax_year": self.tax_year,
            "quarter": self.quarter.value if self.quarter else None,
            "amount_due": self.amount_due,
            "amount_paid": self.amount_paid,
            "due_date": str(self.due_date),
            "status": self.status.value if self.status else None,
            "is_overdue": self.is_overdue,
            "days_until_due": self.days_until_due,
        }


class TaxDeduction(Base):
    __tablename__ = "tax_deductions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    tax_year = Column(String(4), nullable=False)
    
    deduction_type = Column(Enum(DeductionType), nullable=False)
    schedule_c_line = Column(String(10), nullable=True)
    category = Column(String(100), nullable=True)
    
    description = Column(String(255), nullable=False)
    
    amount = Column(Float, nullable=False)
    deductible_amount = Column(Float, nullable=False)
    deduction_rate = Column(Float, default=1.0)
    
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    documentation_required = Column(Boolean, default=False)
    documentation_url = Column(String(500), nullable=True)
    documentation_notes = Column(Text, nullable=True)
    
    related_transactions = Column(ARRAY(UUID(as_uuid=True)), default=list)
    
    is_recurring = Column(Boolean, default=False)
    frequency = Column(String(20), nullable=True)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_tax_deductions_user_year", "user_id", "tax_year"),
        Index("ix_tax_deductions_user_type", "user_id", "deduction_type"),
    )
    
    def verify(self) -> None:
        self.is_verified = True
        self.verified_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "type": self.deduction_type.value if self.deduction_type else None,
            "category": self.category,
            "description": self.description,
            "amount": self.amount,
            "deductible_amount": self.deductible_amount,
            "is_verified": self.is_verified,
        }


class QuarterlyTax(Base):
    __tablename__ = "quarterly_taxes"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    tax_year = Column(String(4), nullable=False)
    quarter = Column(Enum(Quarter), nullable=False)
    
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    
    income_for_period = Column(Float, default=0.0)
    expenses_for_period = Column(Float, default=0.0)
    net_profit = Column(Float, default=0.0)
    
    cumulative_income = Column(Float, default=0.0)
    cumulative_expenses = Column(Float, default=0.0)
    cumulative_profit = Column(Float, default=0.0)
    
    estimated_annual_income = Column(Float, nullable=True)
    estimated_annual_tax = Column(Float, nullable=True)
    
    quarterly_tax_due = Column(Float, default=0.0)
    federal_portion = Column(Float, default=0.0)
    state_portion = Column(Float, default=0.0)
    se_tax_portion = Column(Float, default=0.0)
    
    payment_amount = Column(Float, default=0.0)
    payment_date = Column(Date, nullable=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    safe_harbor_amount = Column(Float, nullable=True)
    annualized_method_amount = Column(Float, nullable=True)
    
    underpayment_penalty_risk = Column(Boolean, default=False)
    penalty_amount = Column(Float, default=0.0)
    
    calculation_method = Column(String(50), default="standard")
    calculation_notes = Column(Text, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_quarterly_taxes_user_year", "user_id", "tax_year"),
        UniqueConstraint("user_id", "tax_year", "quarter", name="uq_user_quarterly_tax"),
    )
    
    @hybrid_property
    def is_paid(self) -> bool:
        return self.payment_status == PaymentStatus.PAID
    
    @hybrid_property
    def is_overdue(self) -> bool:
        if self.is_paid:
            return False
        return date.today() > self.due_date
    
    @hybrid_property
    def days_until_due(self) -> int:
        return (self.due_date - date.today()).days
    
    def record_payment(self, amount: float, payment_date: date = None) -> None:
        self.payment_amount = amount
        self.payment_date = payment_date or date.today()
        if amount >= self.quarterly_tax_due:
            self.payment_status = PaymentStatus.PAID
        else:
            self.payment_status = PaymentStatus.PARTIAL
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "tax_year": self.tax_year,
            "quarter": self.quarter.value if self.quarter else None,
            "period_start": str(self.period_start),
            "period_end": str(self.period_end),
            "due_date": str(self.due_date),
            "income": self.income_for_period,
            "expenses": self.expenses_for_period,
            "net_profit": self.net_profit,
            "tax_due": self.quarterly_tax_due,
            "payment_status": self.payment_status.value if self.payment_status else None,
            "is_overdue": self.is_overdue,
            "days_until_due": self.days_until_due,
        }
