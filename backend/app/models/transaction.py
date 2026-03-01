from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, CheckConstraint, Date, event
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, validates, backref
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal
import uuid
import enum
import re

from app.db.base import Base, SoftDeleteMixin


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    POSTED = "posted"
    CANCELLED = "cancelled"
    FAILED = "failed"
    RETURNED = "returned"


class TransactionType(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"
    FEE = "fee"
    INTEREST = "interest"
    DIVIDEND = "dividend"
    REFUND = "refund"


class PaymentChannel(str, enum.Enum):
    ONLINE = "online"
    IN_STORE = "in_store"
    ACH = "ach"
    WIRE = "wire"
    CHECK = "check"
    ATM = "atm"
    CASH = "cash"
    OTHER = "other"


class TransactionCode(str, enum.Enum):
    ADJUSTMENT = "adjustment"
    ATM = "atm"
    BANK_CHARGE = "bank_charge"
    BILL_PAYMENT = "bill_payment"
    CASH = "cash"
    CASHBACK = "cashback"
    CHEQUE = "cheque"
    DIRECT_DEBIT = "direct_debit"
    INTEREST = "interest"
    NULL = "null"
    ONLINE = "online"
    PLACE_HOLDER = "place_holder"
    PURCHASE = "purchase"
    REPEAT_PAYMENT = "repeat_payment"
    STANDING_ORDER = "standing_order"
    TRANSFER = "transfer"


class ScheduleCCategory(str, enum.Enum):
    ADVERTISING = "advertising"
    CAR_AND_TRUCK = "car_and_truck"
    COMMISSIONS_AND_FEES = "commissions_and_fees"
    CONTRACT_LABOR = "contract_labor"
    DEPLETION = "depletion"
    DEPRECIATION = "depreciation"
    EMPLOYEE_BENEFITS = "employee_benefits"
    INSURANCE = "insurance"
    INTEREST_MORTGAGE = "interest_mortgage"
    INTEREST_OTHER = "interest_other"
    LEGAL_AND_PROFESSIONAL = "legal_and_professional"
    OFFICE_EXPENSE = "office_expense"
    PENSION_AND_PROFIT_SHARING = "pension_and_profit_sharing"
    RENT_VEHICLES = "rent_vehicles"
    RENT_EQUIPMENT = "rent_equipment"
    RENT_PROPERTY = "rent_property"
    REPAIRS_AND_MAINTENANCE = "repairs_and_maintenance"
    SUPPLIES = "supplies"
    TAXES_AND_LICENSES = "taxes_and_licenses"
    TRAVEL = "travel"
    MEALS = "meals"
    UTILITIES = "utilities"
    WAGES = "wages"
    HOME_OFFICE = "home_office"
    OTHER = "other"


class RecurrenceFrequency(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"


class Transaction(Base, SoftDeleteMixin):
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True)
    
    plaid_transaction_id = Column(String(100), unique=True, nullable=True)
    plaid_pending_transaction_id = Column(String(100), nullable=True)
    plaid_account_id = Column(String(100), nullable=True)
    
    transaction_date = Column(Date, nullable=False)
    authorized_date = Column(Date, nullable=True)
    posted_date = Column(Date, nullable=True)
    datetime_original = Column(DateTime(timezone=True), nullable=True)
    
    amount = Column(Float, nullable=False)
    amount_cents = Column(Integer, nullable=True)
    iso_currency_code = Column(String(3), default="USD")
    unofficial_currency_code = Column(String(10), nullable=True)
    original_amount = Column(Float, nullable=True)
    original_currency = Column(String(3), nullable=True)
    exchange_rate = Column(Float, nullable=True)
    
    name = Column(String(500), nullable=True)
    merchant_name = Column(String(255), nullable=True)
    merchant_name_normalized = Column(String(255), nullable=True)
    merchant_entity_id = Column(String(100), nullable=True)
    
    description = Column(Text, nullable=True)
    original_description = Column(Text, nullable=True)
    
    plaid_category = Column(String(255), nullable=True)
    plaid_category_id = Column(String(50), nullable=True)
    plaid_primary_category = Column(String(100), nullable=True)
    plaid_detailed_category = Column(String(100), nullable=True)
    plaid_confidence_level = Column(String(20), nullable=True)
    
    user_category = Column(String(100), nullable=True)
    user_subcategory = Column(String(100), nullable=True)
    schedule_c_category = Column(Enum(ScheduleCCategory), nullable=True)
    
    is_income = Column(Boolean, default=False, nullable=False)
    is_expense = Column(Boolean, default=True, nullable=False)
    is_business_expense = Column(Boolean, default=False, nullable=False)
    is_tax_deductible = Column(Boolean, default=False, nullable=False)
    is_recurring = Column(Boolean, default=False, nullable=False)
    is_transfer = Column(Boolean, default=False, nullable=False)
    is_subscription = Column(Boolean, default=False, nullable=False)
    is_bill = Column(Boolean, default=False, nullable=False)
    is_paycheck = Column(Boolean, default=False, nullable=False)
    is_refund = Column(Boolean, default=False, nullable=False)
    
    status = Column(Enum(TransactionStatus), default=TransactionStatus.POSTED, nullable=False)
    transaction_type = Column(Enum(TransactionType), default=TransactionType.DEBIT, nullable=False)
    transaction_code = Column(Enum(TransactionCode), nullable=True)
    
    payment_channel = Column(String(50), nullable=True)
    payment_method = Column(String(50), nullable=True)
    payment_processor = Column(String(100), nullable=True)
    check_number = Column(String(20), nullable=True)
    
    location_address = Column(String(255), nullable=True)
    location_city = Column(String(100), nullable=True)
    location_state = Column(String(50), nullable=True)
    location_zip = Column(String(20), nullable=True)
    location_country = Column(String(50), nullable=True)
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    location_store_number = Column(String(50), nullable=True)
    
    logo_url = Column(String(500), nullable=True)
    website = Column(String(255), nullable=True)
    
    receipt_url = Column(String(500), nullable=True)
    receipt_uploaded_at = Column(DateTime(timezone=True), nullable=True)
    receipt_ocr_data = Column(JSONB, nullable=True)
    receipt_verified = Column(Boolean, default=False)
    
    notes = Column(Text, nullable=True)
    memo = Column(String(500), nullable=True)
    tags = Column(ARRAY(String), default=list)
    labels = Column(ARRAY(String), default=list)
    
    ai_categorized = Column(Boolean, default=False, nullable=False)
    ai_category_confidence = Column(Float, nullable=True)
    ai_categorized_at = Column(DateTime(timezone=True), nullable=True)
    ai_suggested_category = Column(String(100), nullable=True)
    ai_insights = Column(JSONB, nullable=True)
    
    is_split = Column(Boolean, default=False, nullable=False)
    parent_transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True)
    split_index = Column(Integer, nullable=True)
    split_total = Column(Integer, nullable=True)
    
    recurring_transaction_id = Column(UUID(as_uuid=True), nullable=True)
    recurrence_frequency = Column(Enum(RecurrenceFrequency), nullable=True)
    recurrence_next_date = Column(Date, nullable=True)
    recurrence_end_date = Column(Date, nullable=True)
    
    is_reconciled = Column(Boolean, default=False, nullable=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)
    reconciled_by = Column(UUID(as_uuid=True), nullable=True)
    
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    income_source_id = Column(UUID(as_uuid=True), ForeignKey("income_sources.id", ondelete="SET NULL"), nullable=True)
    
    business_percentage = Column(Float, default=100.0)
    deductible_amount = Column(Float, nullable=True)
    
    counterparty_name = Column(String(255), nullable=True)
    counterparty_type = Column(String(50), nullable=True)
    
    personal_finance_category_primary = Column(String(100), nullable=True)
    personal_finance_category_detailed = Column(String(100), nullable=True)
    personal_finance_category_confidence = Column(String(20), nullable=True)
    personal_finance_category_icon = Column(String(100), nullable=True)
    
    is_reviewed = Column(Boolean, default=False, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True)
    
    is_hidden = Column(Boolean, default=False, nullable=False)
    is_excluded_from_reports = Column(Boolean, default=False, nullable=False)
    is_excluded_from_budget = Column(Boolean, default=False, nullable=False)
    
    import_source = Column(String(50), nullable=True)
    import_batch_id = Column(String(100), nullable=True)
    imported_at = Column(DateTime(timezone=True), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    plaid_meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="transactions")
    account = relationship("Account", back_populates="transactions")
    invoice = relationship("Invoice", back_populates="transactions")
    client = relationship("Client", back_populates="transactions")
    income_source = relationship("IncomeSource", back_populates="transactions")
    
    split_children = relationship("Transaction", backref=backref("parent_transaction", remote_side=[id]), lazy="selectin")
    
    __table_args__ = (
        Index("ix_transactions_user_date", "user_id", "transaction_date"),
        Index("ix_transactions_user_category", "user_id", "user_category"),
        Index("ix_transactions_user_business", "user_id", "is_business_expense"),
        Index("ix_transactions_user_income", "user_id", "is_income"),
        Index("ix_transactions_account_date", "account_id", "transaction_date"),
        Index("ix_transactions_merchant", "merchant_name_normalized"),
        Index("ix_transactions_date_amount", "transaction_date", "amount"),
        Index("ix_transactions_schedule_c", "schedule_c_category"),
        Index("ix_transactions_recurring", "is_recurring", "recurrence_frequency"),
        Index("ix_transactions_plaid", "plaid_transaction_id"),
        CheckConstraint("amount IS NOT NULL", name="check_amount_not_null"),
        CheckConstraint("business_percentage >= 0 AND business_percentage <= 100", name="check_business_percentage"),
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.merchant_name and not self.merchant_name_normalized:
            self.merchant_name_normalized = self._normalize_merchant_name(self.merchant_name)
        if self.amount is not None:
            self.amount_cents = int(round(abs(self.amount) * 100))
            self._set_transaction_direction()
    
    @staticmethod
    def _normalize_merchant_name(name: str) -> str:
        if not name:
            return ""
        name = name.lower().strip()
        name = re.sub(r'[^\w\s]', '', name)
        name = re.sub(r'\s+', ' ', name)
        name = re.sub(r'\s*#?\d+$', '', name)
        name = re.sub(r'\s*(llc|inc|corp|ltd|co)\s*$', '', name, flags=re.IGNORECASE)
        return name.strip()
    
    def _set_transaction_direction(self) -> None:
        if self.amount is None:
            return
        if self.amount < 0:
            self.is_income = True
            self.is_expense = False
            self.transaction_type = TransactionType.CREDIT
        else:
            self.is_income = False
            self.is_expense = True
            self.transaction_type = TransactionType.DEBIT
    
    @validates("amount")
    def validate_amount(self, key: str, value: Any) -> float:
        if value is None:
            raise ValueError("Amount is required")
        try:
            amount = float(value)
            self.amount_cents = int(round(abs(amount) * 100))
            return amount
        except (TypeError, ValueError):
            raise ValueError(f"Invalid amount: {value}")
    
    @validates("merchant_name")
    def validate_merchant_name(self, key: str, value: str) -> Optional[str]:
        if value:
            self.merchant_name_normalized = self._normalize_merchant_name(value)
        return value
    
    @validates("business_percentage")
    def validate_business_percentage(self, key: str, value: Any) -> float:
        if value is None:
            return 100.0
        try:
            pct = float(value)
            if pct < 0 or pct > 100:
                raise ValueError("Business percentage must be between 0 and 100")
            return pct
        except (TypeError, ValueError):
            raise ValueError(f"Invalid business percentage: {value}")
    
    @hybrid_property
    def display_amount(self) -> float:
        if self.is_income:
            return abs(self.amount)
        return -abs(self.amount) if self.amount > 0 else self.amount
    
    @hybrid_property
    def absolute_amount(self) -> float:
        return abs(self.amount) if self.amount else 0
    
    @hybrid_property
    def category_display(self) -> str:
        if self.user_category:
            return self.user_category
        if self.schedule_c_category:
            return self.schedule_c_category.value.replace("_", " ").title()
        if self.plaid_primary_category:
            return self.plaid_primary_category
        if self.plaid_category:
            return self.plaid_category.split(",")[0] if "," in self.plaid_category else self.plaid_category
        return "Uncategorized"
    
    @hybrid_property
    def is_categorized(self) -> bool:
        return bool(self.user_category or self.schedule_c_category or self.is_business_expense)
    
    @hybrid_property
    def tax_deduction_amount(self) -> float:
        if not self.is_tax_deductible:
            return 0.0
        amount = abs(self.amount)
        if self.schedule_c_category == ScheduleCCategory.MEALS:
            amount *= 0.5
        if self.business_percentage < 100:
            amount *= (self.business_percentage / 100)
        return amount
    
    @hybrid_property
    def effective_deductible_amount(self) -> float:
        if self.deductible_amount is not None:
            return self.deductible_amount
        return self.tax_deduction_amount
    
    @hybrid_property
    def merchant_display(self) -> str:
        return self.merchant_name or self.name or self.description or "Unknown"
    
    @hybrid_property
    def days_since_transaction(self) -> int:
        if not self.transaction_date:
            return 0
        if isinstance(self.transaction_date, datetime):
            txn_date = self.transaction_date.date()
        else:
            txn_date = self.transaction_date
        return (date.today() - txn_date).days
    
    @hybrid_property
    def is_recent(self) -> bool:
        return self.days_since_transaction <= 7
    
    @hybrid_property
    def tax_year(self) -> int:
        if not self.transaction_date:
            return datetime.utcnow().year
        if isinstance(self.transaction_date, datetime):
            return self.transaction_date.year
        return self.transaction_date.year
    
    @hybrid_property
    def tax_quarter(self) -> int:
        if not self.transaction_date:
            return 1
        if isinstance(self.transaction_date, datetime):
            month = self.transaction_date.month
        else:
            month = self.transaction_date.month
        return (month - 1) // 3 + 1
    
    def mark_as_business_expense(self, category: ScheduleCCategory = None, percentage: float = 100.0) -> None:
        self.is_business_expense = True
        self.is_tax_deductible = True
        self.business_percentage = percentage
        if category:
            self.schedule_c_category = category
        self.deductible_amount = self.tax_deduction_amount
    
    def mark_as_personal(self) -> None:
        self.is_business_expense = False
        self.is_tax_deductible = False
        self.business_percentage = 0
        self.schedule_c_category = None
        self.deductible_amount = None
    
    def set_category(self, category: str, subcategory: str = None) -> None:
        self.user_category = category
        self.user_subcategory = subcategory
    
    def set_ai_category(self, category: str, confidence: float, suggested: str = None) -> None:
        self.ai_categorized = True
        self.ai_category_confidence = confidence
        self.ai_categorized_at = datetime.utcnow()
        self.ai_suggested_category = suggested or category
        if confidence >= 0.8 and not self.user_category:
            self.user_category = category
    
    def add_receipt(self, url: str, ocr_data: Dict = None) -> None:
        self.receipt_url = url
        self.receipt_uploaded_at = datetime.utcnow()
        if ocr_data:
            self.receipt_ocr_data = ocr_data
    
    def verify_receipt(self) -> None:
        self.receipt_verified = True
    
    def mark_as_recurring(self, frequency: RecurrenceFrequency, next_date: date = None) -> None:
        self.is_recurring = True
        self.recurrence_frequency = frequency
        if next_date:
            self.recurrence_next_date = next_date
        else:
            self.recurrence_next_date = self._calculate_next_recurrence()
    
    def _calculate_next_recurrence(self) -> Optional[date]:
        if not self.transaction_date or not self.recurrence_frequency:
            return None
        
        txn_date = self.transaction_date if isinstance(self.transaction_date, date) else self.transaction_date.date()
        
        frequency_days = {
            RecurrenceFrequency.DAILY: 1,
            RecurrenceFrequency.WEEKLY: 7,
            RecurrenceFrequency.BIWEEKLY: 14,
            RecurrenceFrequency.MONTHLY: 30,
            RecurrenceFrequency.QUARTERLY: 90,
            RecurrenceFrequency.SEMI_ANNUAL: 180,
            RecurrenceFrequency.ANNUAL: 365,
        }
        
        days = frequency_days.get(self.recurrence_frequency, 30)
        return txn_date + timedelta(days=days)
    
    def reconcile(self, by_user_id: uuid.UUID = None) -> None:
        self.is_reconciled = True
        self.reconciled_at = datetime.utcnow()
        if by_user_id:
            self.reconciled_by = by_user_id
    
    def review(self, by_user_id: uuid.UUID = None) -> None:
        self.is_reviewed = True
        self.reviewed_at = datetime.utcnow()
        if by_user_id:
            self.reviewed_by = by_user_id
    
    def hide(self) -> None:
        self.is_hidden = True
    
    def unhide(self) -> None:
        self.is_hidden = False
    
    def exclude_from_reports(self) -> None:
        self.is_excluded_from_reports = True
    
    def include_in_reports(self) -> None:
        self.is_excluded_from_reports = False
    
    def add_tag(self, tag: str) -> None:
        if not self.tags:
            self.tags = []
        if tag not in self.tags:
            self.tags.append(tag)
    
    def remove_tag(self, tag: str) -> None:
        if self.tags and tag in self.tags:
            self.tags.remove(tag)
    
    def add_note(self, note: str) -> None:
        if self.notes:
            self.notes = f"{self.notes}\n{note}"
        else:
            self.notes = note
    
    def link_to_invoice(self, invoice_id: uuid.UUID) -> None:
        self.invoice_id = invoice_id
        self.is_income = True
    
    def link_to_client(self, client_id: uuid.UUID) -> None:
        self.client_id = client_id
    
    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "date": str(self.transaction_date),
            "amount": self.display_amount,
            "merchant": self.merchant_display,
            "category": self.category_display,
            "is_income": self.is_income,
            "is_business": self.is_business_expense,
            "is_recurring": self.is_recurring,
        }
    
    def to_full_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "account_id": str(self.account_id) if self.account_id else None,
            "transaction_date": str(self.transaction_date),
            "authorized_date": str(self.authorized_date) if self.authorized_date else None,
            "amount": self.amount,
            "display_amount": self.display_amount,
            "currency": self.iso_currency_code,
            "merchant_name": self.merchant_name,
            "name": self.name,
            "description": self.description,
            "category": self.category_display,
            "user_category": self.user_category,
            "schedule_c_category": self.schedule_c_category.value if self.schedule_c_category else None,
            "plaid_category": self.plaid_category,
            "is_income": self.is_income,
            "is_expense": self.is_expense,
            "is_business_expense": self.is_business_expense,
            "is_tax_deductible": self.is_tax_deductible,
            "is_recurring": self.is_recurring,
            "is_transfer": self.is_transfer,
            "business_percentage": self.business_percentage,
            "deductible_amount": self.effective_deductible_amount,
            "status": self.status.value if self.status else None,
            "payment_channel": self.payment_channel,
            "location": {
                "city": self.location_city,
                "state": self.location_state,
                "address": self.location_address,
            } if self.location_city else None,
            "receipt_url": self.receipt_url,
            "notes": self.notes,
            "tags": self.tags,
            "is_reviewed": self.is_reviewed,
            "is_reconciled": self.is_reconciled,
            "ai_categorized": self.ai_categorized,
            "ai_confidence": self.ai_category_confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, merchant={self.merchant_name}, amount={self.amount}, date={self.transaction_date})>"


@event.listens_for(Transaction, "before_insert")
def transaction_before_insert(mapper, connection, target):
    if target.merchant_name and not target.merchant_name_normalized:
        target.merchant_name_normalized = Transaction._normalize_merchant_name(target.merchant_name)
    if target.amount is not None:
        target.amount_cents = int(round(abs(target.amount) * 100))
        target._set_transaction_direction()


@event.listens_for(Transaction, "before_update")
def transaction_before_update(mapper, connection, target):
    if target.merchant_name:
        target.merchant_name_normalized = Transaction._normalize_merchant_name(target.merchant_name)
