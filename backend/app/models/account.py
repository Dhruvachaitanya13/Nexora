from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, CheckConstraint, event, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, validates, backref
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from decimal import Decimal
import uuid
import enum

from app.db.base import Base, SoftDeleteMixin


class AccountType(str, enum.Enum):
    DEPOSITORY = "depository"
    CREDIT = "credit"
    LOAN = "loan"
    INVESTMENT = "investment"
    BROKERAGE = "brokerage"
    RETIREMENT = "retirement"
    MORTGAGE = "mortgage"
    OTHER = "other"


class AccountSubtype(str, enum.Enum):
    CHECKING = "checking"
    SAVINGS = "savings"
    MONEY_MARKET = "money_market"
    CD = "cd"
    CASH_MANAGEMENT = "cash_management"
    EBT = "ebt"
    PAYPAL = "paypal"
    PREPAID = "prepaid"
    CREDIT_CARD = "credit_card"
    AUTO = "auto"
    BUSINESS = "business"
    COMMERCIAL = "commercial"
    CONSTRUCTION = "construction"
    CONSUMER = "consumer"
    HOME_EQUITY = "home_equity"
    LINE_OF_CREDIT = "line_of_credit"
    LOAN = "loan"
    MORTGAGE = "mortgage"
    OVERDRAFT = "overdraft"
    STUDENT = "student"
    BROKERAGE = "brokerage"
    CASH_ISA = "cash_isa"
    CRYPTO_EXCHANGE = "crypto_exchange"
    EDUCATION_SAVINGS = "education_savings"
    FIXED_ANNUITY = "fixed_annuity"
    GIC = "gic"
    HEALTH_REIMBURSEMENT = "health_reimbursement"
    HSA = "hsa"
    ISA = "isa"
    IRA = "ira"
    LIF = "lif"
    LIFE_INSURANCE = "life_insurance"
    LIRA = "lira"
    LRIF = "lrif"
    LRSP = "lrsp"
    MUTUAL_FUND = "mutual_fund"
    NON_CUSTODIAL_WALLET = "non_custodial_wallet"
    NON_TAXABLE_BROKERAGE = "non_taxable_brokerage"
    OTHER = "other"
    OTHER_INSURANCE = "other_insurance"
    OTHER_ANNUITY = "other_annuity"
    PENSION = "pension"
    PRIF = "prif"
    PROFIT_SHARING_PLAN = "profit_sharing_plan"
    QSHR = "qshr"
    RDSP = "rdsp"
    RESP = "resp"
    RETIREMENT = "retirement"
    RLIF = "rlif"
    ROTH = "roth"
    ROTH_401K = "roth_401k"
    RRIF = "rrif"
    RRSP = "rrsp"
    SARSEP = "sarsep"
    SEP_IRA = "sep_ira"
    SIMPLE_IRA = "simple_ira"
    SIPP = "sipp"
    STOCK_PLAN = "stock_plan"
    TFSA = "tfsa"
    TRUST = "trust"
    UGMA = "ugma"
    UTMA = "utma"
    VARIABLE_ANNUITY = "variable_annuity"
    FOUR_01_A = "401a"
    FOUR_01_K = "401k"
    FOUR_03_B = "403b"
    FOUR_57_B = "457b"
    FIVE_29 = "529"


class AccountSyncStatus(str, enum.Enum):
    PENDING = "pending"
    SYNCING = "syncing"
    SYNCED = "synced"
    ERROR = "error"
    STALE = "stale"


class AccountPurpose(str, enum.Enum):
    OPERATING = "operating"
    SAVINGS = "savings"
    TAX_RESERVE = "tax_reserve"
    EMERGENCY_FUND = "emergency_fund"
    PAYROLL = "payroll"
    BUSINESS_EXPENSE = "business_expense"
    PERSONAL = "personal"
    INVESTMENT = "investment"
    RETIREMENT = "retirement"
    OTHER = "other"


class Account(Base, SoftDeleteMixin):
    __tablename__ = "accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plaid_item_id = Column(UUID(as_uuid=True), ForeignKey("plaid_items.id", ondelete="SET NULL"), nullable=True)
    
    plaid_account_id = Column(String(100), unique=True, nullable=True)
    plaid_persistent_account_id = Column(String(100), nullable=True)
    
    account_name = Column(String(255), nullable=False)
    official_name = Column(String(255), nullable=True)
    nickname = Column(String(100), nullable=True)
    
    institution_id = Column(String(50), nullable=True)
    institution_name = Column(String(255), nullable=True)
    institution_logo = Column(Text, nullable=True)
    institution_color = Column(String(10), nullable=True)
    institution_url = Column(String(255), nullable=True)
    routing_number = Column(String(20), nullable=True)
    
    account_type = Column(Enum(AccountType), default=AccountType.DEPOSITORY, nullable=False)
    account_subtype = Column(String(50), nullable=True)
    account_subtype_enum = Column(Enum(AccountSubtype), nullable=True)
    
    account_mask = Column(String(10), nullable=True)
    account_number_encrypted = Column(String(500), nullable=True)
    
    current_balance = Column(Float, default=0.0, nullable=False)
    available_balance = Column(Float, nullable=True)
    limit_amount = Column(Float, nullable=True)
    credit_limit = Column(Float, nullable=True)
    
    iso_currency_code = Column(String(3), default="USD")
    unofficial_currency_code = Column(String(10), nullable=True)
    
    balance_last_updated = Column(DateTime(timezone=True), nullable=True)
    balance_update_frequency = Column(String(20), default="daily")
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)
    is_manual = Column(Boolean, default=False, nullable=False)
    is_business_account = Column(Boolean, default=False, nullable=False)
    is_tax_account = Column(Boolean, default=False, nullable=False)
    
    purpose = Column(Enum(AccountPurpose), default=AccountPurpose.OPERATING, nullable=True)
    category = Column(String(50), nullable=True)
    
    sync_status = Column(Enum(AccountSyncStatus), default=AccountSyncStatus.PENDING, nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    last_sync_error = Column(Text, nullable=True)
    sync_error_count = Column(Integer, default=0)
    next_sync_at = Column(DateTime(timezone=True), nullable=True)
    
    transactions_cursor = Column(String(255), nullable=True)
    oldest_transaction_date = Column(DateTime, nullable=True)
    newest_transaction_date = Column(DateTime, nullable=True)
    transaction_count = Column(Integer, default=0)
    
    verification_status = Column(String(50), default="unverified")
    verification_method = Column(String(50), nullable=True)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    
    interest_rate_percentage = Column(Float, nullable=True)
    interest_rate_type = Column(String(20), nullable=True)
    apr_percentage = Column(Float, nullable=True)
    apr_type = Column(String(20), nullable=True)
    
    minimum_payment_amount = Column(Float, nullable=True)
    next_payment_due_date = Column(DateTime, nullable=True)
    last_payment_amount = Column(Float, nullable=True)
    last_payment_date = Column(DateTime, nullable=True)
    last_statement_balance = Column(Float, nullable=True)
    last_statement_date = Column(DateTime, nullable=True)
    
    origination_date = Column(DateTime, nullable=True)
    origination_principal_amount = Column(Float, nullable=True)
    next_monthly_payment = Column(Float, nullable=True)
    ytd_interest_paid = Column(Float, nullable=True)
    ytd_principal_paid = Column(Float, nullable=True)
    
    holder_name = Column(String(255), nullable=True)
    holder_category = Column(String(50), nullable=True)
    
    budget_amount = Column(Float, nullable=True)
    budget_period = Column(String(20), nullable=True)
    target_balance = Column(Float, nullable=True)
    
    alert_low_balance = Column(Boolean, default=False)
    alert_low_balance_threshold = Column(Float, nullable=True)
    alert_large_transaction = Column(Boolean, default=False)
    alert_large_transaction_threshold = Column(Float, nullable=True)
    alert_unusual_activity = Column(Boolean, default=True)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    plaid_meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="accounts")
    plaid_item = relationship("PlaidItem", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan", lazy="selectin", order_by="desc(Transaction.transaction_date)")
    
    __table_args__ = (
        Index("ix_accounts_user_active", "user_id", "is_active"),
        Index("ix_accounts_user_type", "user_id", "account_type"),
        Index("ix_accounts_institution", "institution_id", "institution_name"),
        Index("ix_accounts_sync_status", "sync_status", "next_sync_at"),
        Index("ix_accounts_balance", "current_balance"),
        UniqueConstraint("user_id", "plaid_account_id", name="uq_user_plaid_account"),
        CheckConstraint("current_balance IS NOT NULL", name="check_current_balance_not_null"),
    )
    
    @validates("current_balance", "available_balance", "credit_limit")
    def validate_balance(self, key: str, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid {key} value: {value}")
    
    @hybrid_property
    def display_name(self) -> str:
        if self.nickname:
            return self.nickname
        if self.account_mask:
            return f"{self.account_name} (****{self.account_mask})"
        return self.account_name
    
    @hybrid_property
    def balance_display(self) -> float:
        if self.account_type == AccountType.CREDIT:
            return -abs(self.current_balance) if self.current_balance else 0
        return self.current_balance or 0
    
    @hybrid_property
    def is_credit_account(self) -> bool:
        return self.account_type == AccountType.CREDIT
    
    @hybrid_property
    def is_loan_account(self) -> bool:
        return self.account_type in [AccountType.LOAN, AccountType.MORTGAGE]
    
    @hybrid_property
    def is_investment_account(self) -> bool:
        return self.account_type in [AccountType.INVESTMENT, AccountType.BROKERAGE, AccountType.RETIREMENT]
    
    @hybrid_property
    def is_depository_account(self) -> bool:
        return self.account_type == AccountType.DEPOSITORY
    
    @hybrid_property
    def credit_utilization(self) -> Optional[float]:
        if not self.is_credit_account or not self.credit_limit or self.credit_limit <= 0:
            return None
        return (abs(self.current_balance or 0) / self.credit_limit) * 100
    
    @hybrid_property
    def available_credit(self) -> Optional[float]:
        if not self.is_credit_account or not self.credit_limit:
            return None
        return self.credit_limit - abs(self.current_balance or 0)
    
    @hybrid_property
    def needs_sync(self) -> bool:
        if not self.last_synced_at:
            return True
        if self.sync_status == AccountSyncStatus.ERROR and self.sync_error_count >= 5:
            return False
        hours_since_sync = (datetime.utcnow() - self.last_synced_at).total_seconds() / 3600
        return hours_since_sync >= 24
    
    @hybrid_property
    def is_stale(self) -> bool:
        if not self.last_synced_at:
            return True
        hours_since_sync = (datetime.utcnow() - self.last_synced_at).total_seconds() / 3600
        return hours_since_sync >= 48
    
    @hybrid_property
    def sync_health(self) -> str:
        if self.sync_status == AccountSyncStatus.ERROR:
            return "error"
        if self.is_stale:
            return "stale"
        if self.needs_sync:
            return "needs_sync"
        return "healthy"
    
    def update_balance(self, current: float, available: float = None) -> None:
        self.current_balance = current
        if available is not None:
            self.available_balance = available
        self.balance_last_updated = datetime.utcnow()
    
    def mark_synced(self) -> None:
        self.sync_status = AccountSyncStatus.SYNCED
        self.last_synced_at = datetime.utcnow()
        self.last_sync_error = None
        self.sync_error_count = 0
        self.next_sync_at = datetime.utcnow() + timedelta(hours=24)
    
    def mark_sync_error(self, error: str) -> None:
        self.sync_status = AccountSyncStatus.ERROR
        self.last_sync_error = error
        self.sync_error_count += 1
        backoff_hours = min(24 * (2 ** self.sync_error_count), 168)
        self.next_sync_at = datetime.utcnow() + timedelta(hours=backoff_hours)
    
    def set_as_primary(self) -> None:
        self.is_primary = True
    
    def update_transaction_stats(self, count: int, oldest: datetime = None, newest: datetime = None) -> None:
        self.transaction_count = count
        if oldest:
            self.oldest_transaction_date = oldest
        if newest:
            self.newest_transaction_date = newest
    
    def should_alert_low_balance(self) -> bool:
        if not self.alert_low_balance or not self.alert_low_balance_threshold:
            return False
        if self.is_credit_account:
            return False
        return (self.current_balance or 0) < self.alert_low_balance_threshold
    
    def should_alert_high_utilization(self, threshold: float = 80.0) -> bool:
        if not self.is_credit_account:
            return False
        utilization = self.credit_utilization
        return utilization is not None and utilization >= threshold
    
    def get_monthly_budget_remaining(self) -> Optional[float]:
        if not self.budget_amount or not self.budget_period:
            return None
        return self.budget_amount
    
    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.display_name,
            "institution": self.institution_name,
            "type": self.account_type.value if self.account_type else None,
            "subtype": self.account_subtype,
            "balance": self.balance_display,
            "available": self.available_balance,
            "currency": self.iso_currency_code,
            "is_business": self.is_business_account,
            "sync_status": self.sync_health,
            "last_synced": self.last_synced_at.isoformat() if self.last_synced_at else None,
        }
    
    def to_full_dict(self) -> Dict[str, Any]:
        base = self.to_summary_dict()
        base.update({
            "mask": self.account_mask,
            "official_name": self.official_name,
            "is_primary": self.is_primary,
            "is_hidden": self.is_hidden,
            "purpose": self.purpose.value if self.purpose else None,
            "credit_limit": self.credit_limit,
            "credit_utilization": self.credit_utilization,
            "interest_rate": self.interest_rate_percentage,
            "minimum_payment": self.minimum_payment_amount,
            "next_payment_due": self.next_payment_due_date.isoformat() if self.next_payment_due_date else None,
            "transaction_count": self.transaction_count,
            "oldest_transaction": self.oldest_transaction_date.isoformat() if self.oldest_transaction_date else None,
            "newest_transaction": self.newest_transaction_date.isoformat() if self.newest_transaction_date else None,
            "notes": self.notes,
            "tags": self.tags,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        })
        return base
    
    def __repr__(self) -> str:
        return f"<Account(id={self.id}, name={self.account_name}, type={self.account_type}, balance={self.current_balance})>"


@event.listens_for(Account, "before_update")
def account_before_update(mapper, connection, target):
    if target.sync_status == AccountSyncStatus.SYNCED:
        if not target.last_synced_at:
            target.last_synced_at = datetime.utcnow()
