from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, Date, event, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal
import uuid
import enum

from app.db.base import Base, SoftDeleteMixin


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    VIEWED = "viewed"
    PAID = "paid"
    PARTIALLY_PAID = "partially_paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"
    DISPUTED = "disputed"
    WRITE_OFF = "write_off"


class PaymentTerm(str, enum.Enum):
    DUE_ON_RECEIPT = "due_on_receipt"
    NET_7 = "net_7"
    NET_10 = "net_10"
    NET_14 = "net_14"
    NET_15 = "net_15"
    NET_21 = "net_21"
    NET_30 = "net_30"
    NET_45 = "net_45"
    NET_60 = "net_60"
    NET_90 = "net_90"
    CUSTOM = "custom"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "bank_transfer"
    ACH = "ach"
    WIRE = "wire"
    CHECK = "check"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    PAYPAL = "paypal"
    STRIPE = "stripe"
    VENMO = "venmo"
    ZELLE = "zelle"
    CASH = "cash"
    CRYPTO = "crypto"
    OTHER = "other"


class InvoiceType(str, enum.Enum):
    STANDARD = "standard"
    RECURRING = "recurring"
    RETAINER = "retainer"
    DEPOSIT = "deposit"
    FINAL = "final"
    CREDIT_NOTE = "credit_note"
    ESTIMATE = "estimate"
    QUOTE = "quote"


class RecurringFrequency(str, enum.Enum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"


class Invoice(Base, SoftDeleteMixin):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    
    invoice_number = Column(String(50), nullable=False)
    invoice_number_prefix = Column(String(20), default="INV")
    invoice_number_sequence = Column(Integer, nullable=True)
    reference_number = Column(String(100), nullable=True)
    po_number = Column(String(100), nullable=True)
    
    invoice_type = Column(Enum(InvoiceType), default=InvoiceType.STANDARD, nullable=False)
    status = Column(Enum(InvoiceStatus), default=InvoiceStatus.DRAFT, nullable=False)
    
    title = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    issue_date = Column(Date, nullable=False, default=date.today)
    due_date = Column(Date, nullable=False)
    payment_terms = Column(Enum(PaymentTerm), default=PaymentTerm.NET_30, nullable=False)
    custom_payment_days = Column(Integer, nullable=True)
    
    currency = Column(String(3), default="USD")
    exchange_rate = Column(Float, default=1.0)
    
    subtotal = Column(Float, default=0.0, nullable=False)
    discount_type = Column(String(20), nullable=True)
    discount_value = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    
    tax_rate = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    tax_name = Column(String(50), nullable=True)
    is_tax_inclusive = Column(Boolean, default=False)
    
    shipping_amount = Column(Float, default=0.0)
    
    total_amount = Column(Float, default=0.0, nullable=False)
    amount_paid = Column(Float, default=0.0, nullable=False)
    amount_due = Column(Float, default=0.0, nullable=False)
    
    deposit_required = Column(Boolean, default=False)
    deposit_percentage = Column(Float, nullable=True)
    deposit_amount = Column(Float, nullable=True)
    deposit_paid = Column(Boolean, default=False)
    deposit_paid_at = Column(DateTime(timezone=True), nullable=True)
    
    late_fee_type = Column(String(20), nullable=True)
    late_fee_value = Column(Float, nullable=True)
    late_fee_amount = Column(Float, default=0.0)
    late_fee_applied = Column(Boolean, default=False)
    grace_period_days = Column(Integer, default=0)
    
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    accepted_payment_methods = Column(ARRAY(String), default=["bank_transfer", "credit_card"])
    payment_instructions = Column(Text, nullable=True)
    payment_link = Column(String(500), nullable=True)
    
    bank_name = Column(String(255), nullable=True)
    bank_account_name = Column(String(255), nullable=True)
    bank_account_number = Column(String(50), nullable=True)
    bank_routing_number = Column(String(50), nullable=True)
    bank_swift_code = Column(String(20), nullable=True)
    
    client_name = Column(String(255), nullable=True)
    client_email = Column(String(255), nullable=True)
    client_phone = Column(String(50), nullable=True)
    client_company = Column(String(255), nullable=True)
    client_address_line1 = Column(String(255), nullable=True)
    client_address_line2 = Column(String(255), nullable=True)
    client_city = Column(String(100), nullable=True)
    client_state = Column(String(50), nullable=True)
    client_zip = Column(String(20), nullable=True)
    client_country = Column(String(50), default="US")
    client_tax_id = Column(String(50), nullable=True)
    
    from_name = Column(String(255), nullable=True)
    from_email = Column(String(255), nullable=True)
    from_phone = Column(String(50), nullable=True)
    from_company = Column(String(255), nullable=True)
    from_address_line1 = Column(String(255), nullable=True)
    from_address_line2 = Column(String(255), nullable=True)
    from_city = Column(String(100), nullable=True)
    from_state = Column(String(50), nullable=True)
    from_zip = Column(String(20), nullable=True)
    from_country = Column(String(50), default="US")
    from_tax_id = Column(String(50), nullable=True)
    from_logo_url = Column(String(500), nullable=True)
    
    notes = Column(Text, nullable=True)
    terms_and_conditions = Column(Text, nullable=True)
    footer_text = Column(Text, nullable=True)
    private_notes = Column(Text, nullable=True)
    
    is_recurring = Column(Boolean, default=False, nullable=False)
    recurring_frequency = Column(Enum(RecurringFrequency), nullable=True)
    recurring_start_date = Column(Date, nullable=True)
    recurring_end_date = Column(Date, nullable=True)
    recurring_next_date = Column(Date, nullable=True)
    recurring_count = Column(Integer, default=0)
    recurring_max_count = Column(Integer, nullable=True)
    recurring_parent_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    auto_send_recurring = Column(Boolean, default=True)
    
    sent_at = Column(DateTime(timezone=True), nullable=True)
    sent_count = Column(Integer, default=0)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    viewed_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, default=0)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)
    
    paid_at = Column(DateTime(timezone=True), nullable=True)
    paid_in_full_at = Column(DateTime(timezone=True), nullable=True)
    
    reminder_enabled = Column(Boolean, default=True)
    reminder_days_before = Column(ARRAY(Integer), default=[7, 3, 1])
    reminder_days_after = Column(ARRAY(Integer), default=[1, 7, 14, 30])
    last_reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    reminder_count = Column(Integer, default=0)
    
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_reason = Column(Text, nullable=True)
    
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    refund_amount = Column(Float, default=0.0)
    refund_reason = Column(Text, nullable=True)
    
    write_off_at = Column(DateTime(timezone=True), nullable=True)
    write_off_amount = Column(Float, default=0.0)
    write_off_reason = Column(Text, nullable=True)
    
    public_url = Column(String(500), nullable=True)
    public_token = Column(String(100), nullable=True)
    pdf_url = Column(String(500), nullable=True)
    
    template_id = Column(String(50), nullable=True)
    custom_fields = Column(JSONB, default=dict)
    attachments = Column(JSONB, default=list)
    
    stripe_invoice_id = Column(String(100), nullable=True)
    stripe_payment_intent_id = Column(String(100), nullable=True)
    paypal_invoice_id = Column(String(100), nullable=True)
    external_invoice_id = Column(String(100), nullable=True)
    
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="invoices")
    client = relationship("Client", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin", order_by="InvoiceItem.position")
    payments = relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")
    transactions = relationship("Transaction", back_populates="invoice", lazy="selectin")
    recurring_children = relationship("Invoice", backref="recurring_parent", remote_side=[id], lazy="selectin")
    
    __table_args__ = (
        Index("ix_invoices_user_status", "user_id", "status"),
        Index("ix_invoices_user_client", "user_id", "client_id"),
        Index("ix_invoices_due_date", "due_date", "status"),
        Index("ix_invoices_number", "invoice_number"),
        UniqueConstraint("user_id", "invoice_number", name="uq_user_invoice_number"),
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.public_token:
            self.public_token = self._generate_public_token()
    
    @staticmethod
    def _generate_public_token() -> str:
        import secrets
        return secrets.token_urlsafe(32)
    
    @validates("total_amount", "subtotal", "amount_paid")
    def validate_amounts(self, key: str, value: Any) -> float:
        if value is None:
            return 0.0
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid {key}: {value}")
    
    @hybrid_property
    def is_draft(self) -> bool:
        return self.status == InvoiceStatus.DRAFT
    
    @hybrid_property
    def is_sent(self) -> bool:
        return self.status in [InvoiceStatus.SENT, InvoiceStatus.VIEWED]
    
    @hybrid_property
    def is_paid(self) -> bool:
        return self.status == InvoiceStatus.PAID
    
    @hybrid_property
    def is_partially_paid(self) -> bool:
        return self.status == InvoiceStatus.PARTIALLY_PAID
    
    @hybrid_property
    def is_overdue(self) -> bool:
        if self.status in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED, InvoiceStatus.REFUNDED]:
            return False
        if not self.due_date:
            return False
        return date.today() > self.due_date and self.amount_due > 0
    
    @hybrid_property
    def days_overdue(self) -> int:
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days
    
    @hybrid_property
    def days_until_due(self) -> int:
        if not self.due_date:
            return 0
        delta = self.due_date - date.today()
        return delta.days
    
    @hybrid_property
    def payment_percentage(self) -> float:
        if self.total_amount <= 0:
            return 0.0
        return (self.amount_paid / self.total_amount) * 100
    
    @hybrid_property
    def balance_due(self) -> float:
        return max(0, self.total_amount - self.amount_paid)
    
    def calculate_totals(self) -> None:
        items_total = sum(item.total for item in self.items) if self.items else 0
        self.subtotal = items_total
        
        if self.discount_type == "percentage":
            self.discount_amount = self.subtotal * (self.discount_value / 100)
        elif self.discount_type == "fixed":
            self.discount_amount = self.discount_value
        else:
            self.discount_amount = 0
        
        taxable_amount = self.subtotal - self.discount_amount
        self.tax_amount = taxable_amount * (self.tax_rate / 100)
        
        self.total_amount = taxable_amount + self.tax_amount + self.shipping_amount
        self.amount_due = self.total_amount - self.amount_paid
        
        if self.deposit_required and self.deposit_percentage:
            self.deposit_amount = self.total_amount * (self.deposit_percentage / 100)
    
    def calculate_due_date(self) -> None:
        if not self.issue_date:
            self.issue_date = date.today()
        
        days_map = {
            PaymentTerm.DUE_ON_RECEIPT: 0,
            PaymentTerm.NET_7: 7,
            PaymentTerm.NET_10: 10,
            PaymentTerm.NET_14: 14,
            PaymentTerm.NET_15: 15,
            PaymentTerm.NET_21: 21,
            PaymentTerm.NET_30: 30,
            PaymentTerm.NET_45: 45,
            PaymentTerm.NET_60: 60,
            PaymentTerm.NET_90: 90,
        }
        
        if self.payment_terms == PaymentTerm.CUSTOM:
            days = self.custom_payment_days or 30
        else:
            days = days_map.get(self.payment_terms, 30)
        
        self.due_date = self.issue_date + timedelta(days=days)
    
    def apply_late_fee(self) -> None:
        if not self.is_overdue:
            return
        if self.late_fee_applied:
            return
        if self.days_overdue <= self.grace_period_days:
            return
        
        if self.late_fee_type == "percentage":
            self.late_fee_amount = self.amount_due * (self.late_fee_value / 100)
        elif self.late_fee_type == "fixed":
            self.late_fee_amount = self.late_fee_value
        
        if self.late_fee_amount > 0:
            self.total_amount += self.late_fee_amount
            self.amount_due += self.late_fee_amount
            self.late_fee_applied = True
    
    def mark_as_sent(self) -> None:
        self.status = InvoiceStatus.SENT
        self.sent_at = datetime.utcnow()
        self.sent_count += 1
        self.last_sent_at = datetime.utcnow()
    
    def mark_as_viewed(self) -> None:
        if self.status == InvoiceStatus.SENT:
            self.status = InvoiceStatus.VIEWED
        self.viewed_at = self.viewed_at or datetime.utcnow()
        self.view_count += 1
        self.last_viewed_at = datetime.utcnow()
    
    def record_payment(self, amount: float, payment_date: datetime = None) -> None:
        self.amount_paid += amount
        self.amount_due = max(0, self.total_amount - self.amount_paid)
        
        if self.amount_due <= 0:
            self.status = InvoiceStatus.PAID
            self.paid_at = payment_date or datetime.utcnow()
            self.paid_in_full_at = self.paid_at
        elif self.amount_paid > 0:
            self.status = InvoiceStatus.PARTIALLY_PAID
            if not self.paid_at:
                self.paid_at = payment_date or datetime.utcnow()
    
    def mark_as_overdue(self) -> None:
        if self.status not in [InvoiceStatus.PAID, InvoiceStatus.CANCELLED]:
            self.status = InvoiceStatus.OVERDUE
    
    def cancel(self, reason: str = None) -> None:
        self.status = InvoiceStatus.CANCELLED
        self.cancelled_at = datetime.utcnow()
        self.cancelled_reason = reason
    
    def refund(self, amount: float, reason: str = None) -> None:
        self.status = InvoiceStatus.REFUNDED
        self.refunded_at = datetime.utcnow()
        self.refund_amount = amount
        self.refund_reason = reason
    
    def write_off(self, amount: float = None, reason: str = None) -> None:
        self.status = InvoiceStatus.WRITE_OFF
        self.write_off_at = datetime.utcnow()
        self.write_off_amount = amount or self.amount_due
        self.write_off_reason = reason
    
    def record_reminder_sent(self) -> None:
        self.last_reminder_sent_at = datetime.utcnow()
        self.reminder_count += 1
    
    def add_item(self, item: "InvoiceItem") -> None:
        item.position = len(list(self.items)) + 1
        self.items.append(item)
        self.calculate_totals()
    
    def generate_next_recurring(self) -> Optional["Invoice"]:
        if not self.is_recurring:
            return None
        if self.recurring_max_count and self.recurring_count >= self.recurring_max_count:
            return None
        if self.recurring_end_date and date.today() > self.recurring_end_date:
            return None
        
        new_invoice = Invoice(
            user_id=self.user_id,
            client_id=self.client_id,
            invoice_type=self.invoice_type,
            recurring_parent_id=self.id,
            issue_date=self.recurring_next_date or date.today(),
            payment_terms=self.payment_terms,
            currency=self.currency,
            tax_rate=self.tax_rate,
            discount_type=self.discount_type,
            discount_value=self.discount_value,
        )
        
        self.recurring_count += 1
        self._calculate_next_recurring_date()
        
        return new_invoice
    
    def _calculate_next_recurring_date(self) -> None:
        current = self.recurring_next_date or self.issue_date or date.today()
        
        frequency_days = {
            RecurringFrequency.WEEKLY: 7,
            RecurringFrequency.BIWEEKLY: 14,
            RecurringFrequency.MONTHLY: 30,
            RecurringFrequency.QUARTERLY: 90,
            RecurringFrequency.SEMI_ANNUAL: 180,
            RecurringFrequency.ANNUAL: 365,
        }
        
        days = frequency_days.get(self.recurring_frequency, 30)
        self.recurring_next_date = current + timedelta(days=days)
    
    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "invoice_number": self.invoice_number,
            "client_name": self.client_name,
            "status": self.status.value if self.status else None,
            "total_amount": self.total_amount,
            "amount_due": self.amount_due,
            "issue_date": str(self.issue_date) if self.issue_date else None,
            "due_date": str(self.due_date) if self.due_date else None,
            "is_overdue": self.is_overdue,
            "days_overdue": self.days_overdue,
        }
    
    def to_full_dict(self) -> Dict[str, Any]:
        base = self.to_summary_dict()
        base.update({
            "client_id": str(self.client_id) if self.client_id else None,
            "title": self.title,
            "description": self.description,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "tax_amount": self.tax_amount,
            "amount_paid": self.amount_paid,
            "payment_terms": self.payment_terms.value if self.payment_terms else None,
            "currency": self.currency,
            "is_recurring": self.is_recurring,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None,
            "notes": self.notes,
            "public_url": self.public_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        })
        return base
    
    def __repr__(self) -> str:
        return f"<Invoice(id={self.id}, number={self.invoice_number}, status={self.status}, total={self.total_amount})>"


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    
    position = Column(Integer, default=1)
    item_type = Column(String(50), default="service")
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    sku = Column(String(100), nullable=True)
    
    quantity = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), nullable=True)
    unit_price = Column(Float, default=0.0, nullable=False)
    
    discount_type = Column(String(20), nullable=True)
    discount_value = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    
    tax_rate = Column(Float, default=0.0)
    tax_amount = Column(Float, default=0.0)
    is_taxable = Column(Boolean, default=True)
    
    total = Column(Float, default=0.0, nullable=False)
    
    date_of_service = Column(Date, nullable=True)
    hours = Column(Float, nullable=True)
    rate_per_hour = Column(Float, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    invoice = relationship("Invoice", back_populates="items")
    
    def calculate_total(self) -> None:
        subtotal = self.quantity * self.unit_price
        
        if self.discount_type == "percentage":
            self.discount_amount = subtotal * (self.discount_value / 100)
        elif self.discount_type == "fixed":
            self.discount_amount = self.discount_value
        
        after_discount = subtotal - self.discount_amount
        
        if self.is_taxable:
            self.tax_amount = after_discount * (self.tax_rate / 100)
        
        self.total = after_discount + self.tax_amount
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "description": self.description,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "total": self.total,
        }


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    
    amount = Column(Float, nullable=False)
    currency = Column(String(3), default="USD")
    payment_date = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    payment_method = Column(Enum(PaymentMethod), nullable=True)
    
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    
    stripe_payment_id = Column(String(100), nullable=True)
    paypal_payment_id = Column(String(100), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    invoice = relationship("Invoice", back_populates="payments")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "amount": self.amount,
            "payment_date": self.payment_date.isoformat() if self.payment_date else None,
            "payment_method": self.payment_method.value if self.payment_method else None,
        }
