from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Float, Integer, Index, CheckConstraint, event
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY, INET
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum
import re
import json

from app.db.base import Base, SoftDeleteMixin, AuditMixin


class BusinessType(str, enum.Enum):
    FREELANCER = "freelancer"
    SOLE_PROPRIETOR = "sole_proprietor"
    LLC = "llc"
    S_CORP = "s_corp"
    C_CORP = "c_corp"
    PARTNERSHIP = "partnership"
    CONTRACTOR = "contractor"
    CONSULTANT = "consultant"
    GIG_WORKER = "gig_worker"
    CREATOR = "creator"
    OTHER = "other"


class SubscriptionTier(str, enum.Enum):
    FREE = "free"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    BUSINESS = "business"
    ENTERPRISE = "enterprise"


class UserStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"
    DELETED = "deleted"


class FilingStatus(str, enum.Enum):
    SINGLE = "single"
    MARRIED_FILING_JOINTLY = "married_filing_jointly"
    MARRIED_FILING_SEPARATELY = "married_filing_separately"
    HEAD_OF_HOUSEHOLD = "head_of_household"
    QUALIFYING_WIDOW = "qualifying_widow"


class OnboardingStep(str, enum.Enum):
    WELCOME = "welcome"
    BUSINESS_INFO = "business_info"
    CONNECT_BANK = "connect_bank"
    SET_GOALS = "set_goals"
    TAX_SETUP = "tax_setup"
    COMPLETED = "completed"


class User(Base, SoftDeleteMixin, AuditMixin):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    email = Column(String(255), unique=True, nullable=False)
    email_normalized = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    
    full_name = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    display_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    phone_verified = Column(Boolean, default=False)
    avatar_url = Column(String(500), nullable=True)
    timezone = Column(String(50), default="America/Chicago")
    locale = Column(String(10), default="en-US")
    currency = Column(String(3), default="USD")
    
    business_type = Column(Enum(BusinessType), default=BusinessType.FREELANCER, nullable=False)
    business_name = Column(String(255), nullable=True)
    business_description = Column(Text, nullable=True)
    business_website = Column(String(255), nullable=True)
    business_phone = Column(String(20), nullable=True)
    business_email = Column(String(255), nullable=True)
    business_address_line1 = Column(String(255), nullable=True)
    business_address_line2 = Column(String(255), nullable=True)
    business_city = Column(String(100), nullable=True)
    business_state = Column(String(2), nullable=True)
    business_zip = Column(String(10), nullable=True)
    business_country = Column(String(2), default="US")
    business_ein = Column(String(20), nullable=True)
    business_start_date = Column(DateTime, nullable=True)
    industry = Column(String(100), nullable=True)
    naics_code = Column(String(10), nullable=True)
    
    city = Column(String(100), default="Chicago")
    state = Column(String(2), default="IL")
    zip_code = Column(String(10), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    country = Column(String(2), default="US")
    
    filing_status = Column(Enum(FilingStatus), default=FilingStatus.SINGLE, nullable=False)
    tax_id_type = Column(String(10), default="SSN")
    tax_id_encrypted = Column(String(500), nullable=True)
    state_tax_id = Column(String(50), nullable=True)
    has_self_employment = Column(Boolean, default=True)
    estimated_annual_income = Column(Float, nullable=True)
    tax_year_start_month = Column(Integer, default=1)
    
    status = Column(Enum(UserStatus), default=UserStatus.PENDING_VERIFICATION, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_staff = Column(Boolean, default=False, nullable=False)
    is_beta_tester = Column(Boolean, default=False, nullable=False)
    
    subscription_tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.FREE, nullable=False)
    subscription_status = Column(String(20), default="active")
    subscription_started_at = Column(DateTime(timezone=True), nullable=True)
    subscription_expires_at = Column(DateTime(timezone=True), nullable=True)
    subscription_cancelled_at = Column(DateTime(timezone=True), nullable=True)
    stripe_customer_id = Column(String(100), nullable=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_token = Column(String(100), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)
    password_reset_token = Column(String(100), nullable=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(100), nullable=True)
    two_factor_backup_codes = Column(ARRAY(String), nullable=True)
    two_factor_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(INET, nullable=True)
    last_activity_at = Column(DateTime(timezone=True), nullable=True)
    login_count = Column(Integer, default=0)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    
    onboarding_completed = Column(Boolean, default=False)
    onboarding_step = Column(Enum(OnboardingStep), default=OnboardingStep.WELCOME)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    
    preferences = Column(JSONB, default=dict)
    notification_settings = Column(JSONB, default=dict)
    privacy_settings = Column(JSONB, default=dict)
    feature_flags = Column(JSONB, default=dict)
    
    monthly_income_goal = Column(Float, nullable=True)
    monthly_expense_budget = Column(Float, nullable=True)
    monthly_savings_goal = Column(Float, nullable=True)
    emergency_fund_goal = Column(Float, nullable=True)
    tax_reserve_percentage = Column(Float, default=30.0)
    retirement_contribution_goal = Column(Float, nullable=True)
    
    referral_code = Column(String(20), unique=True, nullable=True)
    referred_by = Column(UUID(as_uuid=True), nullable=True)
    referral_count = Column(Integer, default=0)
    referral_credits = Column(Float, default=0.0)
    
    api_key_hash = Column(String(100), nullable=True)
    api_key_created_at = Column(DateTime(timezone=True), nullable=True)
    api_key_last_used_at = Column(DateTime(timezone=True), nullable=True)
    api_rate_limit = Column(Integer, default=1000)
    
    connected_accounts = Column(JSONB, default=dict)
    integrations = Column(JSONB, default=dict)
    
    meta_data = Column(JSONB, default=dict)
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    plaid_items = relationship("PlaidItem", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    invoices = relationship("Invoice", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    goals = relationship("Goal", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    income_sources = relationship("IncomeSource", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    clients = relationship("Client", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    ai_conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    automations = relationship("Automation", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    tax_estimates = relationship("TaxEstimate", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    tax_payments = relationship("TaxPayment", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    
    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active"),
        Index("ix_users_status", "status"),
        Index("ix_users_subscription", "subscription_tier", "subscription_status"),
        Index("ix_users_business_type", "business_type"),
        Index("ix_users_location", "city", "state"),
        CheckConstraint("tax_reserve_percentage >= 0 AND tax_reserve_percentage <= 100", name="check_tax_reserve_percentage"),
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.email:
            self.email_normalized = self._normalize_email(self.email)
        if not self.referral_code:
            self.referral_code = self._generate_referral_code()
        if not self.preferences:
            self.preferences = self._default_preferences()
        if not self.notification_settings:
            self.notification_settings = self._default_notification_settings()
    
    @staticmethod
    def _normalize_email(email: str) -> str:
        email = email.lower().strip()
        local, domain = email.split("@")
        if domain in ["gmail.com", "googlemail.com"]:
            local = local.replace(".", "").split("+")[0]
        return f"{local}@{domain}"
    
    @staticmethod
    def _generate_referral_code() -> str:
        import secrets
        return f"FT{secrets.token_hex(4).upper()}"
    
    @staticmethod
    def _default_preferences() -> Dict[str, Any]:
        return {
            "theme": "system",
            "language": "en",
            "date_format": "MM/DD/YYYY",
            "time_format": "12h",
            "number_format": "en-US",
            "currency_display": "symbol",
            "week_start": "sunday",
            "fiscal_year_start": "january",
            "dashboard_layout": "default",
            "default_transaction_view": "list",
            "auto_categorization": True,
            "ai_suggestions": True,
            "keyboard_shortcuts": True,
        }
    
    @staticmethod
    def _default_notification_settings() -> Dict[str, Any]:
        return {
            "email_notifications": True,
            "push_notifications": False,
            "sms_notifications": False,
            "tax_deadline_reminders": True,
            "tax_reminder_days_before": [30, 14, 7, 1],
            "weekly_summary": True,
            "weekly_summary_day": "monday",
            "monthly_report": True,
            "transaction_alerts": False,
            "transaction_alert_threshold": 500,
            "low_balance_alerts": True,
            "low_balance_threshold": 1000,
            "unusual_spending_alerts": True,
            "goal_progress_alerts": True,
            "invoice_reminders": True,
            "payment_received_alerts": True,
            "ai_insights": True,
            "ai_insights_frequency": "weekly",
            "marketing_emails": False,
            "product_updates": True,
        }
    
    @validates("email")
    def validate_email(self, key: str, email: str) -> str:
        if not email:
            raise ValueError("Email is required")
        email = email.lower().strip()
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise ValueError("Invalid email format")
        self.email_normalized = self._normalize_email(email)
        return email
    
    @validates("phone")
    def validate_phone(self, key: str, phone: str) -> Optional[str]:
        if not phone:
            return None
        phone = re.sub(r"[^\d+]", "", phone)
        if len(phone) < 10:
            raise ValueError("Invalid phone number")
        return phone
    
    @validates("state")
    def validate_state(self, key: str, state: str) -> str:
        if state and len(state) != 2:
            raise ValueError("State must be 2-letter code")
        return state.upper() if state else state
    
    @hybrid_property
    def is_premium(self) -> bool:
        return self.subscription_tier in [SubscriptionTier.PROFESSIONAL, SubscriptionTier.BUSINESS, SubscriptionTier.ENTERPRISE]
    
    @hybrid_property
    def is_trial_active(self) -> bool:
        if not self.trial_ends_at:
            return False
        return datetime.utcnow() < self.trial_ends_at
    
    @hybrid_property
    def subscription_active(self) -> bool:
        if self.subscription_tier == SubscriptionTier.FREE:
            return True
        if self.is_trial_active:
            return True
        if not self.subscription_expires_at:
            return False
        return datetime.utcnow() < self.subscription_expires_at
    
    @hybrid_property
    def days_until_subscription_expires(self) -> Optional[int]:
        if not self.subscription_expires_at:
            return None
        delta = self.subscription_expires_at - datetime.utcnow()
        return max(0, delta.days)
    
    @hybrid_property
    def display_name_or_email(self) -> str:
        return self.display_name or self.full_name or self.email.split("@")[0]
    
    @hybrid_property
    def initials(self) -> str:
        if self.first_name and self.last_name:
            return f"{self.first_name[0]}{self.last_name[0]}".upper()
        if self.full_name:
            parts = self.full_name.split()
            if len(parts) >= 2:
                return f"{parts[0][0]}{parts[-1][0]}".upper()
            return self.full_name[0].upper()
        return self.email[0].upper()
    
    @property
    def is_account_locked(self) -> bool:
        if not self.locked_until:
            return False
        return datetime.utcnow() < self.locked_until
    
    def lock_account(self, minutes: int = 15) -> None:
        self.locked_until = datetime.utcnow() + timedelta(minutes=minutes)
    
    def unlock_account(self) -> None:
        self.locked_until = None
        self.failed_login_attempts = 0
    
    def record_login(self, ip_address: str = None) -> None:
        self.last_login_at = datetime.utcnow()
        self.last_activity_at = datetime.utcnow()
        self.login_count += 1
        self.failed_login_attempts = 0
        if ip_address:
            self.last_login_ip = ip_address
    
    def record_failed_login(self) -> None:
        self.failed_login_attempts += 1
        if self.failed_login_attempts >= 5:
            self.lock_account()
    
    def complete_onboarding(self) -> None:
        self.onboarding_completed = True
        self.onboarding_step = OnboardingStep.COMPLETED
        self.onboarding_completed_at = datetime.utcnow()
    
    def update_preference(self, key: str, value: Any) -> None:
        if not self.preferences:
            self.preferences = {}
        self.preferences[key] = value
    
    def get_preference(self, key: str, default: Any = None) -> Any:
        if not self.preferences:
            return default
        return self.preferences.get(key, default)
    
    def update_notification_setting(self, key: str, value: Any) -> None:
        if not self.notification_settings:
            self.notification_settings = {}
        self.notification_settings[key] = value
    
    def get_notification_setting(self, key: str, default: Any = None) -> Any:
        if not self.notification_settings:
            return default
        return self.notification_settings.get(key, default)
    
    def has_feature(self, feature: str) -> bool:
        tier_features = {
            SubscriptionTier.FREE: ["basic_transactions", "basic_reports", "ai_chat_limited"],
            SubscriptionTier.STARTER: ["basic_transactions", "basic_reports", "ai_chat", "bank_sync", "tax_estimates"],
            SubscriptionTier.PROFESSIONAL: ["all_transactions", "advanced_reports", "ai_chat", "ai_insights", "bank_sync", "tax_optimization", "forecasting", "invoicing"],
            SubscriptionTier.BUSINESS: ["all_transactions", "advanced_reports", "ai_chat", "ai_insights", "bank_sync", "tax_optimization", "forecasting", "invoicing", "multi_agent", "api_access", "priority_support"],
            SubscriptionTier.ENTERPRISE: ["all"],
        }
        
        if self.subscription_tier == SubscriptionTier.ENTERPRISE:
            return True
        
        features = tier_features.get(self.subscription_tier, [])
        
        if self.feature_flags and self.feature_flags.get(feature):
            return True
        
        return feature in features
    
    def get_tax_reserve_amount(self, income: float) -> float:
        return income * (self.tax_reserve_percentage / 100)
    
    def to_public_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "email": self.email,
            "full_name": self.full_name,
            "display_name": self.display_name_or_email,
            "avatar_url": self.avatar_url,
            "business_type": self.business_type.value if self.business_type else None,
            "business_name": self.business_name,
            "city": self.city,
            "state": self.state,
            "subscription_tier": self.subscription_tier.value if self.subscription_tier else None,
            "is_verified": self.is_verified,
            "is_premium": self.is_premium,
            "onboarding_completed": self.onboarding_completed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
    
    def to_full_dict(self) -> Dict[str, Any]:
        base = self.to_public_dict()
        base.update({
            "phone": self.phone,
            "timezone": self.timezone,
            "locale": self.locale,
            "currency": self.currency,
            "filing_status": self.filing_status.value if self.filing_status else None,
            "monthly_income_goal": self.monthly_income_goal,
            "monthly_savings_goal": self.monthly_savings_goal,
            "emergency_fund_goal": self.emergency_fund_goal,
            "tax_reserve_percentage": self.tax_reserve_percentage,
            "two_factor_enabled": self.two_factor_enabled,
            "subscription_status": self.subscription_status,
            "subscription_expires_at": self.subscription_expires_at.isoformat() if self.subscription_expires_at else None,
            "trial_ends_at": self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            "onboarding_step": self.onboarding_step.value if self.onboarding_step else None,
            "preferences": self.preferences,
            "notification_settings": self.notification_settings,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        })
        return base
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, business_type={self.business_type})>"


@event.listens_for(User, "before_insert")
def user_before_insert(mapper, connection, target):
    if target.email:
        target.email_normalized = User._normalize_email(target.email)
    if target.full_name and not target.first_name:
        parts = target.full_name.split()
        if len(parts) >= 1:
            target.first_name = parts[0]
        if len(parts) >= 2:
            target.last_name = " ".join(parts[1:])


@event.listens_for(User, "before_update")
def user_before_update(mapper, connection, target):
    if target.email:
        target.email_normalized = User._normalize_email(target.email)
