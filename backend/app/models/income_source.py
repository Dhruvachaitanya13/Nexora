from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base, SoftDeleteMixin


class IncomeType(str, enum.Enum):
    FREELANCE = "freelance"
    CONTRACT = "contract"
    RETAINER = "retainer"
    PROJECT = "project"
    HOURLY = "hourly"
    RECURRING = "recurring"
    ONE_TIME = "one_time"
    PASSIVE = "passive"
    AFFILIATE = "affiliate"
    ROYALTY = "royalty"
    CONSULTING = "consulting"
    SALARY = "salary"
    OTHER = "other"


class PaymentFrequency(str, enum.Enum):
    ONE_TIME = "one_time"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    ON_COMPLETION = "on_completion"
    MILESTONE = "milestone"


class IncomeSource(Base, SoftDeleteMixin):
    __tablename__ = "income_sources"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    income_type = Column(Enum(IncomeType), default=IncomeType.FREELANCE, nullable=False)
    payment_frequency = Column(Enum(PaymentFrequency), default=PaymentFrequency.ONE_TIME, nullable=False)
    
    expected_amount = Column(Float, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    project_rate = Column(Float, nullable=True)
    retainer_amount = Column(Float, nullable=True)
    
    currency = Column(String(3), default="USD")
    
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    next_payment_date = Column(Date, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_recurring = Column(Boolean, default=False)
    
    total_earned = Column(Float, default=0.0)
    total_payments = Column(Integer, default=0)
    average_payment = Column(Float, nullable=True)
    last_payment_date = Column(Date, nullable=True)
    last_payment_amount = Column(Float, nullable=True)
    
    platform = Column(String(100), nullable=True)
    platform_fee_percentage = Column(Float, nullable=True)
    
    tax_form = Column(String(20), nullable=True)
    requires_1099 = Column(Boolean, default=False)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="income_sources")
    client = relationship("Client", back_populates="income_sources")
    transactions = relationship("Transaction", back_populates="income_source", lazy="selectin")
    
    __table_args__ = (
        Index("ix_income_sources_user_active", "user_id", "is_active"),
        Index("ix_income_sources_user_type", "user_id", "income_type"),
    )
    
    @hybrid_property
    def monthly_average(self) -> float:
        if self.total_payments == 0:
            return self.expected_amount or 0
        return self.total_earned / max(1, self.total_payments)
    
    def record_payment(self, amount: float, payment_date: date = None) -> None:
        self.total_earned += amount
        self.total_payments += 1
        self.last_payment_amount = amount
        self.last_payment_date = payment_date or date.today()
        self.average_payment = self.total_earned / self.total_payments
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "type": self.income_type.value if self.income_type else None,
            "expected_amount": self.expected_amount,
            "total_earned": self.total_earned,
            "is_active": self.is_active,
        }


class Client(Base, SoftDeleteMixin):
    __tablename__ = "clients"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)
    
    contact_name = Column(String(255), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    country = Column(String(50), default="US")
    
    tax_id = Column(String(50), nullable=True)
    
    payment_terms = Column(String(50), default="net_30")
    default_hourly_rate = Column(Float, nullable=True)
    
    total_revenue = Column(Float, default=0.0)
    total_invoices = Column(Integer, default=0)
    total_paid = Column(Float, default=0.0)
    total_outstanding = Column(Float, default=0.0)
    
    average_payment_days = Column(Float, nullable=True)
    on_time_payment_rate = Column(Float, nullable=True)
    
    first_invoice_date = Column(Date, nullable=True)
    last_invoice_date = Column(Date, nullable=True)
    last_payment_date = Column(Date, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_favorite = Column(Boolean, default=False)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="clients")
    invoices = relationship("Invoice", back_populates="client", lazy="selectin")
    income_sources = relationship("IncomeSource", back_populates="client", lazy="selectin")
    transactions = relationship("Transaction", back_populates="client", lazy="selectin")
    
    __table_args__ = (
        Index("ix_clients_user_active", "user_id", "is_active"),
        Index("ix_clients_user_name", "user_id", "name"),
    )
    
    @hybrid_property
    def display_name(self) -> str:
        if self.company:
            return f"{self.company} ({self.name})"
        return self.name
    
    def record_invoice(self, amount: float, invoice_date: date = None) -> None:
        self.total_revenue += amount
        self.total_invoices += 1
        self.total_outstanding += amount
        self.last_invoice_date = invoice_date or date.today()
        if not self.first_invoice_date:
            self.first_invoice_date = self.last_invoice_date
    
    def record_payment(self, amount: float, payment_date: date = None, days_to_pay: int = None) -> None:
        self.total_paid += amount
        self.total_outstanding = max(0, self.total_outstanding - amount)
        self.last_payment_date = payment_date or date.today()
        
        if days_to_pay is not None:
            if self.average_payment_days is None:
                self.average_payment_days = days_to_pay
            else:
                self.average_payment_days = (self.average_payment_days + days_to_pay) / 2
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "company": self.company,
            "email": self.email,
            "total_revenue": self.total_revenue,
            "total_outstanding": self.total_outstanding,
            "is_active": self.is_active,
        }
