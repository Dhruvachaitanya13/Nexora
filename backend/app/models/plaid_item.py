from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, CheckConstraint, event
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base, SoftDeleteMixin


class PlaidItemStatus(str, enum.Enum):
    ACTIVE = "active"
    PENDING = "pending"
    ERROR = "error"
    DISCONNECTED = "disconnected"
    REQUIRES_REAUTH = "requires_reauth"
    ITEM_LOGIN_REQUIRED = "item_login_required"
    PENDING_EXPIRATION = "pending_expiration"
    REVOKED = "revoked"


class PlaidErrorCode(str, enum.Enum):
    ITEM_LOGIN_REQUIRED = "ITEM_LOGIN_REQUIRED"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    INVALID_MFA = "INVALID_MFA"
    ITEM_LOCKED = "ITEM_LOCKED"
    ITEM_NO_ERROR = "ITEM_NO_ERROR"
    ITEM_NOT_SUPPORTED = "ITEM_NOT_SUPPORTED"
    USER_SETUP_REQUIRED = "USER_SETUP_REQUIRED"
    MFA_NOT_SUPPORTED = "MFA_NOT_SUPPORTED"
    NO_ACCOUNTS = "NO_ACCOUNTS"
    NO_AUTH_ACCOUNTS = "NO_AUTH_ACCOUNTS"
    PRODUCT_NOT_READY = "PRODUCT_NOT_READY"
    PRODUCTS_NOT_SUPPORTED = "PRODUCTS_NOT_SUPPORTED"
    INSTITUTION_DOWN = "INSTITUTION_DOWN"
    INSTITUTION_NOT_RESPONDING = "INSTITUTION_NOT_RESPONDING"
    INSTITUTION_NOT_AVAILABLE = "INSTITUTION_NOT_AVAILABLE"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"
    PLANNED_MAINTENANCE = "PLANNED_MAINTENANCE"


class PlaidProduct(str, enum.Enum):
    TRANSACTIONS = "transactions"
    AUTH = "auth"
    IDENTITY = "identity"
    ASSETS = "assets"
    INVESTMENTS = "investments"
    LIABILITIES = "liabilities"
    PAYMENT_INITIATION = "payment_initiation"
    DEPOSIT_SWITCH = "deposit_switch"
    INCOME_VERIFICATION = "income_verification"
    TRANSFER = "transfer"
    EMPLOYMENT = "employment"
    RECURRING_TRANSACTIONS = "recurring_transactions"


class PlaidItem(Base, SoftDeleteMixin):
    __tablename__ = "plaid_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    plaid_item_id = Column(String(100), unique=True, nullable=False)
    plaid_access_token = Column(String(500), nullable=False)
    plaid_access_token_encrypted = Column(Text, nullable=True)
    
    institution_id = Column(String(50), nullable=True)
    institution_name = Column(String(255), nullable=True)
    institution_logo = Column(Text, nullable=True)
    institution_primary_color = Column(String(10), nullable=True)
    institution_url = Column(String(255), nullable=True)
    institution_country_codes = Column(ARRAY(String), default=["US"])
    institution_routing_numbers = Column(ARRAY(String), nullable=True)
    institution_oauth = Column(Boolean, default=False)
    
    available_products = Column(ARRAY(String), nullable=True)
    billed_products = Column(ARRAY(String), nullable=True)
    consented_products = Column(ARRAY(String), nullable=True)
    products = Column(ARRAY(String), default=["transactions"])
    
    status = Column(Enum(PlaidItemStatus), default=PlaidItemStatus.ACTIVE, nullable=False)
    error_code = Column(String(100), nullable=True)
    error_type = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    error_display_message = Column(Text, nullable=True)
    error_request_id = Column(String(100), nullable=True)
    error_causes = Column(JSONB, nullable=True)
    error_status = Column(Integer, nullable=True)
    error_documentation_url = Column(String(500), nullable=True)
    error_suggested_action = Column(Text, nullable=True)
    last_error_at = Column(DateTime(timezone=True), nullable=True)
    consecutive_errors = Column(Integer, default=0)
    
    webhook_url = Column(String(500), nullable=True)
    webhook_secret = Column(String(100), nullable=True)
    
    consent_expiration_time = Column(DateTime(timezone=True), nullable=True)
    update_type = Column(String(50), default="background")
    
    transactions_cursor = Column(String(500), nullable=True)
    transactions_last_successful_update = Column(DateTime(timezone=True), nullable=True)
    transactions_last_failed_update = Column(DateTime(timezone=True), nullable=True)
    transactions_initial_update_complete = Column(Boolean, default=False)
    transactions_historical_update_complete = Column(Boolean, default=False)
    transactions_oldest_date = Column(DateTime, nullable=True)
    transactions_newest_date = Column(DateTime, nullable=True)
    
    investments_cursor = Column(String(500), nullable=True)
    investments_last_successful_update = Column(DateTime(timezone=True), nullable=True)
    investments_last_failed_update = Column(DateTime(timezone=True), nullable=True)
    
    liabilities_last_successful_update = Column(DateTime(timezone=True), nullable=True)
    liabilities_last_failed_update = Column(DateTime(timezone=True), nullable=True)
    
    identity_last_successful_update = Column(DateTime(timezone=True), nullable=True)
    identity_data = Column(JSONB, nullable=True)
    
    auth_last_successful_update = Column(DateTime(timezone=True), nullable=True)
    auth_data = Column(JSONB, nullable=True)
    
    last_successful_sync = Column(DateTime(timezone=True), nullable=True)
    last_failed_sync = Column(DateTime(timezone=True), nullable=True)
    last_webhook_received = Column(DateTime(timezone=True), nullable=True)
    last_webhook_code = Column(String(100), nullable=True)
    
    total_transactions_synced = Column(Integer, default=0)
    total_accounts_linked = Column(Integer, default=0)
    sync_frequency_hours = Column(Integer, default=24)
    next_scheduled_sync = Column(DateTime(timezone=True), nullable=True)
    
    sync_error_count = Column(Integer, default=0)
    sync_success_count = Column(Integer, default=0)
    sync_total_count = Column(Integer, default=0)
    
    link_session_id = Column(String(100), nullable=True)
    link_token = Column(String(500), nullable=True)
    link_token_expiration = Column(DateTime(timezone=True), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False)
    is_manual = Column(Boolean, default=False)
    requires_relink = Column(Boolean, default=False)
    
    user_consent_given_at = Column(DateTime(timezone=True), nullable=True)
    user_consent_expires_at = Column(DateTime(timezone=True), nullable=True)
    privacy_mode = Column(Boolean, default=False)
    
    created_via = Column(String(50), default="link")
    environment = Column(String(20), default="sandbox")
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    plaid_meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="plaid_items")
    accounts = relationship("Account", back_populates="plaid_item", cascade="all, delete-orphan", lazy="selectin")
    
    __table_args__ = (
        Index("ix_plaid_items_user_status", "user_id", "status"),
        Index("ix_plaid_items_institution", "institution_id"),
        Index("ix_plaid_items_next_sync", "next_scheduled_sync"),
        Index("ix_plaid_items_active", "is_active", "status"),
    )
    
    @validates("plaid_access_token")
    def validate_access_token(self, key: str, value: str) -> str:
        if not value:
            raise ValueError("Access token is required")
        return value
    
    @hybrid_property
    def is_healthy(self) -> bool:
        return self.status == PlaidItemStatus.ACTIVE and self.is_active
    
    @hybrid_property
    def needs_reauth(self) -> bool:
        return self.status in [
            PlaidItemStatus.ERROR,
            PlaidItemStatus.REQUIRES_REAUTH,
            PlaidItemStatus.ITEM_LOGIN_REQUIRED,
            PlaidItemStatus.REVOKED,
        ]
    
    @hybrid_property
    def is_expired(self) -> bool:
        if not self.consent_expiration_time:
            return False
        return datetime.utcnow() > self.consent_expiration_time
    
    @hybrid_property
    def days_until_expiration(self) -> Optional[int]:
        if not self.consent_expiration_time:
            return None
        delta = self.consent_expiration_time - datetime.utcnow()
        return max(0, delta.days)
    
    @hybrid_property
    def needs_sync(self) -> bool:
        if not self.is_healthy:
            return False
        if not self.last_successful_sync:
            return True
        hours_since_sync = (datetime.utcnow() - self.last_successful_sync).total_seconds() / 3600
        return hours_since_sync >= self.sync_frequency_hours
    
    @hybrid_property
    def hours_since_last_sync(self) -> Optional[float]:
        if not self.last_successful_sync:
            return None
        return (datetime.utcnow() - self.last_successful_sync).total_seconds() / 3600
    
    @hybrid_property
    def sync_health(self) -> str:
        if not self.is_healthy:
            return "error"
        if self.needs_reauth:
            return "requires_reauth"
        if not self.last_successful_sync:
            return "never_synced"
        hours = self.hours_since_last_sync
        if hours and hours >= 48:
            return "stale"
        if hours and hours >= 24:
            return "needs_sync"
        return "healthy"
    
    @hybrid_property
    def sync_success_rate(self) -> float:
        if self.sync_total_count == 0:
            return 0.0
        return (self.sync_success_count / self.sync_total_count) * 100
    
    @hybrid_property
    def has_transactions_product(self) -> bool:
        products = self.products or []
        return "transactions" in products
    
    @hybrid_property
    def has_auth_product(self) -> bool:
        products = self.products or []
        return "auth" in products
    
    @hybrid_property
    def has_identity_product(self) -> bool:
        products = self.products or []
        return "identity" in products
    
    @hybrid_property
    def has_investments_product(self) -> bool:
        products = self.products or []
        return "investments" in products
    
    @hybrid_property
    def has_liabilities_product(self) -> bool:
        products = self.products or []
        return "liabilities" in products
    
    def mark_active(self) -> None:
        self.status = PlaidItemStatus.ACTIVE
        self.error_code = None
        self.error_type = None
        self.error_message = None
        self.error_display_message = None
        self.consecutive_errors = 0
        self.requires_relink = False
    
    def mark_error(
        self,
        error_code: str,
        error_message: str,
        error_type: str = None,
        display_message: str = None,
        request_id: str = None,
    ) -> None:
        self.status = PlaidItemStatus.ERROR
        self.error_code = error_code
        self.error_type = error_type
        self.error_message = error_message
        self.error_display_message = display_message or error_message
        self.error_request_id = request_id
        self.last_error_at = datetime.utcnow()
        self.consecutive_errors += 1
        self.last_failed_sync = datetime.utcnow()
        
        if error_code in ["ITEM_LOGIN_REQUIRED", "INVALID_CREDENTIALS", "INVALID_MFA"]:
            self.status = PlaidItemStatus.ITEM_LOGIN_REQUIRED
            self.requires_relink = True
    
    def mark_requires_reauth(self) -> None:
        self.status = PlaidItemStatus.REQUIRES_REAUTH
        self.requires_relink = True
    
    def mark_disconnected(self) -> None:
        self.status = PlaidItemStatus.DISCONNECTED
        self.is_active = False
    
    def mark_revoked(self) -> None:
        self.status = PlaidItemStatus.REVOKED
        self.is_active = False
    
    def mark_sync_success(self, transactions_synced: int = 0) -> None:
        self.last_successful_sync = datetime.utcnow()
        self.sync_success_count += 1
        self.sync_total_count += 1
        self.consecutive_errors = 0
        
        if transactions_synced > 0:
            self.total_transactions_synced += transactions_synced
            self.transactions_last_successful_update = datetime.utcnow()
        
        self.schedule_next_sync()
        
        if self.status != PlaidItemStatus.ACTIVE:
            self.mark_active()
    
    def mark_sync_failure(self, error: str = None) -> None:
        self.last_failed_sync = datetime.utcnow()
        self.sync_error_count += 1
        self.sync_total_count += 1
        self.consecutive_errors += 1
        
        backoff_hours = min(self.sync_frequency_hours * (2 ** self.consecutive_errors), 168)
        self.next_scheduled_sync = datetime.utcnow() + timedelta(hours=backoff_hours)
    
    def schedule_next_sync(self, hours: int = None) -> None:
        hours = hours or self.sync_frequency_hours
        self.next_scheduled_sync = datetime.utcnow() + timedelta(hours=hours)
    
    def update_transactions_cursor(self, cursor: str) -> None:
        self.transactions_cursor = cursor
    
    def update_investments_cursor(self, cursor: str) -> None:
        self.investments_cursor = cursor
    
    def set_transactions_dates(self, oldest: datetime = None, newest: datetime = None) -> None:
        if oldest:
            self.transactions_oldest_date = oldest
        if newest:
            self.transactions_newest_date = newest
    
    def mark_initial_update_complete(self) -> None:
        self.transactions_initial_update_complete = True
    
    def mark_historical_update_complete(self) -> None:
        self.transactions_historical_update_complete = True
    
    def record_webhook(self, webhook_code: str) -> None:
        self.last_webhook_received = datetime.utcnow()
        self.last_webhook_code = webhook_code
    
    def update_account_count(self, count: int) -> None:
        self.total_accounts_linked = count
    
    def set_link_token(self, token: str, expiration: datetime) -> None:
        self.link_token = token
        self.link_token_expiration = expiration
    
    def clear_link_token(self) -> None:
        self.link_token = None
        self.link_token_expiration = None
    
    def add_product(self, product: str) -> None:
        if not self.products:
            self.products = []
        if product not in self.products:
            self.products.append(product)
    
    def remove_product(self, product: str) -> None:
        if self.products and product in self.products:
            self.products.remove(product)
    
    def deactivate(self) -> None:
        self.is_active = False
        self.status = PlaidItemStatus.DISCONNECTED
    
    def reactivate(self) -> None:
        self.is_active = True
        self.status = PlaidItemStatus.PENDING
    
    def to_summary_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "institution_name": self.institution_name,
            "institution_logo": self.institution_logo,
            "status": self.status.value if self.status else None,
            "is_healthy": self.is_healthy,
            "needs_reauth": self.needs_reauth,
            "accounts_count": self.total_accounts_linked,
            "last_synced": self.last_successful_sync.isoformat() if self.last_successful_sync else None,
            "sync_health": self.sync_health,
        }
    
    def to_full_dict(self) -> Dict[str, Any]:
        base = self.to_summary_dict()
        base.update({
            "institution_id": self.institution_id,
            "institution_url": self.institution_url,
            "products": self.products,
            "available_products": self.available_products,
            "error_code": self.error_code,
            "error_message": self.error_display_message,
            "consecutive_errors": self.consecutive_errors,
            "transactions_synced": self.total_transactions_synced,
            "sync_success_rate": self.sync_success_rate,
            "next_scheduled_sync": self.next_scheduled_sync.isoformat() if self.next_scheduled_sync else None,
            "consent_expiration": self.consent_expiration_time.isoformat() if self.consent_expiration_time else None,
            "days_until_expiration": self.days_until_expiration,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        })
        return base
    
    def __repr__(self) -> str:
        return f"<PlaidItem(id={self.id}, institution={self.institution_name}, status={self.status})>"
