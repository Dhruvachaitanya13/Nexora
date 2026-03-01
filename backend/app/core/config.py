from pydantic_settings import BaseSettings
from pydantic import Field, validator, SecretStr
from typing import Optional, List, Dict, Any, Union
from functools import lru_cache
from pathlib import Path
from datetime import timedelta
import os
import json
import secrets


class DatabaseSettings(BaseSettings):
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)
    POSTGRES_USER: str = Field(default="fintech_user")
    POSTGRES_PASSWORD: str = Field(default="fintech_pass")
    POSTGRES_DB: str = Field(default="chicago_fintech")
    DATABASE_URL: Optional[str] = None
    DB_POOL_SIZE: int = Field(default=10, ge=1, le=100)
    DB_MAX_OVERFLOW: int = Field(default=20, ge=0, le=100)
    DB_POOL_TIMEOUT: int = Field(default=30, ge=5, le=300)
    DB_POOL_RECYCLE: int = Field(default=1800, ge=300, le=7200)
    DB_POOL_PRE_PING: bool = Field(default=True)
    DB_ECHO: bool = Field(default=False)
    DB_ECHO_POOL: bool = Field(default=False)
    DB_STATEMENT_TIMEOUT: int = Field(default=30000)
    DB_LOCK_TIMEOUT: int = Field(default=10000)
    
    @validator("DATABASE_URL", pre=True, always=True)
    def build_database_url(cls, v, values):
        if v:
            return v
        return f"postgresql://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_HOST')}:{values.get('POSTGRES_PORT')}/{values.get('POSTGRES_DB')}"

    class Config:
        env_prefix = ""


class RedisSettings(BaseSettings):
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_DB: int = Field(default=0)
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None
    REDIS_CACHE_TTL: int = Field(default=3600)
    REDIS_SESSION_TTL: int = Field(default=86400)
    REDIS_RATE_LIMIT_TTL: int = Field(default=60)
    REDIS_MAX_CONNECTIONS: int = Field(default=50)
    REDIS_SOCKET_TIMEOUT: int = Field(default=5)
    REDIS_SOCKET_CONNECT_TIMEOUT: int = Field(default=5)
    REDIS_RETRY_ON_TIMEOUT: bool = Field(default=True)
    REDIS_HEALTH_CHECK_INTERVAL: int = Field(default=30)
    
    @validator("REDIS_URL", pre=True, always=True)
    def build_redis_url(cls, v, values):
        if v:
            return v
        password_part = f":{values.get('REDIS_PASSWORD')}@" if values.get('REDIS_PASSWORD') else ""
        return f"redis://{password_part}{values.get('REDIS_HOST')}:{values.get('REDIS_PORT')}/{values.get('REDIS_DB')}"

    class Config:
        env_prefix = ""


class SecuritySettings(BaseSettings):
    SECRET_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(64))
    ENCRYPTION_KEY: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=10080)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=30)
    PASSWORD_RESET_TOKEN_EXPIRE_HOURS: int = Field(default=24)
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS: int = Field(default=48)
    API_KEY_EXPIRE_DAYS: int = Field(default=365)
    PASSWORD_MIN_LENGTH: int = Field(default=8)
    PASSWORD_MAX_LENGTH: int = Field(default=128)
    PASSWORD_REQUIRE_UPPERCASE: bool = Field(default=True)
    PASSWORD_REQUIRE_LOWERCASE: bool = Field(default=True)
    PASSWORD_REQUIRE_DIGIT: bool = Field(default=True)
    PASSWORD_REQUIRE_SPECIAL: bool = Field(default=True)
    MAX_LOGIN_ATTEMPTS: int = Field(default=5)
    LOGIN_LOCKOUT_MINUTES: int = Field(default=15)
    SESSION_COOKIE_NAME: str = Field(default="fintrack_session")
    SESSION_COOKIE_SECURE: bool = Field(default=True)
    SESSION_COOKIE_HTTPONLY: bool = Field(default=True)
    SESSION_COOKIE_SAMESITE: str = Field(default="lax")
    CSRF_COOKIE_NAME: str = Field(default="fintrack_csrf")
    CSRF_HEADER_NAME: str = Field(default="X-CSRF-Token")
    BCRYPT_ROUNDS: int = Field(default=12)
    TWO_FACTOR_ISSUER: str = Field(default="Nexora")
    
    class Config:
        env_prefix = ""


class PlaidSettings(BaseSettings):
    PLAID_CLIENT_ID: str = Field(default="")
    PLAID_SECRET: str = Field(default="")
    PLAID_ENV: str = Field(default="sandbox")
    PLAID_PRODUCTS: List[str] = Field(default=["transactions", "auth", "identity", "assets", "investments", "liabilities"])
    PLAID_COUNTRY_CODES: List[str] = Field(default=["US"])
    PLAID_LANGUAGE: str = Field(default="en")
    PLAID_WEBHOOK_URL: Optional[str] = None
    PLAID_REDIRECT_URI: Optional[str] = None
    PLAID_ANDROID_PACKAGE_NAME: Optional[str] = None
    PLAID_LINK_CUSTOMIZATION_NAME: Optional[str] = None
    PLAID_ACCOUNT_FILTERS: Optional[Dict[str, List[str]]] = None
    PLAID_TRANSACTIONS_DAYS_REQUESTED: int = Field(default=730)
    PLAID_TRANSACTIONS_UPDATE_DAYS: int = Field(default=14)
    PLAID_SYNC_BATCH_SIZE: int = Field(default=500)
    PLAID_RATE_LIMIT_REQUESTS: int = Field(default=100)
    PLAID_RATE_LIMIT_PERIOD: int = Field(default=60)
    PLAID_RETRY_ATTEMPTS: int = Field(default=3)
    PLAID_RETRY_DELAY: float = Field(default=1.0)
    PLAID_TIMEOUT: int = Field(default=30)
    
    @validator("PLAID_ENV")
    def validate_plaid_env(cls, v):
        allowed = ["sandbox", "development", "production"]
        if v not in allowed:
            raise ValueError(f"PLAID_ENV must be one of {allowed}")
        return v
    
    @property
    def plaid_host(self) -> str:
        hosts = {
            "sandbox": "https://sandbox.plaid.com",
            "development": "https://development.plaid.com",
            "production": "https://production.plaid.com",
        }
        return hosts.get(self.PLAID_ENV, hosts["sandbox"])

    class Config:
        env_prefix = ""


class OpenAISettings(BaseSettings):
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_ORGANIZATION: Optional[str] = None
    OPENAI_MODEL: str = Field(default="gpt-4o")
    OPENAI_EMBEDDING_MODEL: str = Field(default="text-embedding-3-small")
    OPENAI_MAX_TOKENS: int = Field(default=4096)
    OPENAI_TEMPERATURE: float = Field(default=0.7, ge=0.0, le=2.0)
    OPENAI_TOP_P: float = Field(default=1.0, ge=0.0, le=1.0)
    OPENAI_FREQUENCY_PENALTY: float = Field(default=0.0, ge=-2.0, le=2.0)
    OPENAI_PRESENCE_PENALTY: float = Field(default=0.0, ge=-2.0, le=2.0)
    OPENAI_TIMEOUT: int = Field(default=60)
    OPENAI_MAX_RETRIES: int = Field(default=3)
    OPENAI_RETRY_DELAY: float = Field(default=1.0)
    OPENAI_RATE_LIMIT_RPM: int = Field(default=60)
    OPENAI_RATE_LIMIT_TPM: int = Field(default=90000)
    OPENAI_VISION_MODEL: str = Field(default="gpt-4o")
    OPENAI_VISION_MAX_TOKENS: int = Field(default=1024)
    OPENAI_ASSISTANT_ID: Optional[str] = None
    OPENAI_VECTOR_STORE_ID: Optional[str] = None
    
    class Config:
        env_prefix = ""


class EmailSettings(BaseSettings):
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: str = Field(default="noreply@fintrack.ai")
    SMTP_FROM_NAME: str = Field(default="Nexora")
    SMTP_TLS: bool = Field(default=True)
    SMTP_SSL: bool = Field(default=False)
    SMTP_TIMEOUT: int = Field(default=30)
    SMTP_DEBUG: bool = Field(default=False)
    EMAIL_TEMPLATES_DIR: str = Field(default="templates/email")
    EMAIL_VERIFICATION_SUBJECT: str = Field(default="Verify your Nexora account")
    EMAIL_PASSWORD_RESET_SUBJECT: str = Field(default="Reset your Nexora password")
    EMAIL_WELCOME_SUBJECT: str = Field(default="Welcome to Nexora")
    EMAIL_TAX_REMINDER_SUBJECT: str = Field(default="Tax Deadline Reminder from Nexora")
    EMAIL_WEEKLY_SUMMARY_SUBJECT: str = Field(default="Your Weekly Financial Summary")
    EMAIL_MAX_BATCH_SIZE: int = Field(default=100)
    EMAIL_RATE_LIMIT_PER_MINUTE: int = Field(default=30)
    SENDGRID_API_KEY: Optional[str] = None
    MAILGUN_API_KEY: Optional[str] = None
    MAILGUN_DOMAIN: Optional[str] = None
    
    class Config:
        env_prefix = ""


class TaxSettings(BaseSettings):
    IL_STATE_TAX_RATE: float = Field(default=0.0495)
    SE_TAX_RATE: float = Field(default=0.153)
    SE_TAXABLE_PORTION: float = Field(default=0.9235)
    SS_WAGE_BASE_2024: float = Field(default=168600)
    MEDICARE_ADDITIONAL_TAX_THRESHOLD: float = Field(default=200000)
    MEDICARE_ADDITIONAL_TAX_RATE: float = Field(default=0.009)
    MILEAGE_RATE_2024: float = Field(default=0.67)
    MILEAGE_RATE_MEDICAL_2024: float = Field(default=0.21)
    MILEAGE_RATE_CHARITY_2024: float = Field(default=0.14)
    HOME_OFFICE_SIMPLIFIED_RATE: float = Field(default=5.0)
    HOME_OFFICE_MAX_SQFT: int = Field(default=300)
    STANDARD_DEDUCTION_SINGLE_2024: float = Field(default=14600)
    STANDARD_DEDUCTION_MARRIED_2024: float = Field(default=29200)
    STANDARD_DEDUCTION_HOH_2024: float = Field(default=21900)
    SEP_IRA_MAX_2024: float = Field(default=69000)
    SEP_IRA_CONTRIBUTION_RATE: float = Field(default=0.25)
    SOLO_401K_EMPLOYEE_MAX_2024: float = Field(default=23000)
    SOLO_401K_TOTAL_MAX_2024: float = Field(default=69000)
    HSA_INDIVIDUAL_MAX_2024: float = Field(default=4150)
    HSA_FAMILY_MAX_2024: float = Field(default=8300)
    HSA_CATCH_UP_2024: float = Field(default=1000)
    QSEHRA_INDIVIDUAL_MAX_2024: float = Field(default=6150)
    QSEHRA_FAMILY_MAX_2024: float = Field(default=12450)
    MEALS_DEDUCTION_RATE: float = Field(default=0.50)
    DEPRECIATION_BONUS_2024: float = Field(default=0.60)
    SECTION_179_MAX_2024: float = Field(default=1220000)
    FEDERAL_TAX_BRACKETS_SINGLE_2024: List[Dict[str, float]] = Field(default=[
        {"limit": 11600, "rate": 0.10},
        {"limit": 47150, "rate": 0.12},
        {"limit": 100525, "rate": 0.22},
        {"limit": 191950, "rate": 0.24},
        {"limit": 243725, "rate": 0.32},
        {"limit": 609350, "rate": 0.35},
        {"limit": float("inf"), "rate": 0.37}
    ])
    FEDERAL_TAX_BRACKETS_MARRIED_2024: List[Dict[str, float]] = Field(default=[
        {"limit": 23200, "rate": 0.10},
        {"limit": 94300, "rate": 0.12},
        {"limit": 201050, "rate": 0.22},
        {"limit": 383900, "rate": 0.24},
        {"limit": 487450, "rate": 0.32},
        {"limit": 731200, "rate": 0.35},
        {"limit": float("inf"), "rate": 0.37}
    ])
    QUARTERLY_TAX_DEADLINES: List[Dict[str, Any]] = Field(default=[
        {"quarter": 1, "period_start": "01-01", "period_end": "03-31", "due_month": 4, "due_day": 15},
        {"quarter": 2, "period_start": "04-01", "period_end": "05-31", "due_month": 6, "due_day": 17},
        {"quarter": 3, "period_start": "06-01", "period_end": "08-31", "due_month": 9, "due_day": 16},
        {"quarter": 4, "period_start": "09-01", "period_end": "12-31", "due_month": 1, "due_day": 15, "next_year": True}
    ])
    
    class Config:
        env_prefix = ""


class CacheSettings(BaseSettings):
    CACHE_TYPE: str = Field(default="redis")
    CACHE_DEFAULT_TTL: int = Field(default=3600)
    CACHE_DASHBOARD_TTL: int = Field(default=300)
    CACHE_TRANSACTIONS_TTL: int = Field(default=600)
    CACHE_ACCOUNTS_TTL: int = Field(default=1800)
    CACHE_TAX_CALCULATIONS_TTL: int = Field(default=3600)
    CACHE_AI_RESPONSES_TTL: int = Field(default=1800)
    CACHE_ANALYTICS_TTL: int = Field(default=900)
    CACHE_USER_PROFILE_TTL: int = Field(default=3600)
    CACHE_CATEGORIES_TTL: int = Field(default=86400)
    CACHE_FORECAST_TTL: int = Field(default=3600)
    CACHE_KEY_PREFIX: str = Field(default="fintrack:")
    CACHE_VERSION: str = Field(default="v1")
    CACHE_MAX_SIZE_MB: int = Field(default=512)
    CACHE_EVICTION_POLICY: str = Field(default="allkeys-lru")
    
    class Config:
        env_prefix = ""


class RateLimitSettings(BaseSettings):
    RATE_LIMIT_ENABLED: bool = Field(default=True)
    RATE_LIMIT_STORAGE: str = Field(default="redis")
    RATE_LIMIT_DEFAULT_LIMIT: int = Field(default=100)
    RATE_LIMIT_DEFAULT_PERIOD: int = Field(default=60)
    RATE_LIMIT_AUTH_LIMIT: int = Field(default=10)
    RATE_LIMIT_AUTH_PERIOD: int = Field(default=60)
    RATE_LIMIT_AI_LIMIT: int = Field(default=20)
    RATE_LIMIT_AI_PERIOD: int = Field(default=60)
    RATE_LIMIT_PLAID_LIMIT: int = Field(default=30)
    RATE_LIMIT_PLAID_PERIOD: int = Field(default=60)
    RATE_LIMIT_EXPORT_LIMIT: int = Field(default=5)
    RATE_LIMIT_EXPORT_PERIOD: int = Field(default=300)
    RATE_LIMIT_WEBHOOK_LIMIT: int = Field(default=1000)
    RATE_LIMIT_WEBHOOK_PERIOD: int = Field(default=60)
    RATE_LIMIT_BURST_MULTIPLIER: float = Field(default=1.5)
    RATE_LIMIT_STRATEGY: str = Field(default="fixed-window")
    RATE_LIMIT_HEADERS_ENABLED: bool = Field(default=True)
    RATE_LIMIT_KEY_FUNC: str = Field(default="user_id")
    
    class Config:
        env_prefix = ""


class LoggingSettings(BaseSettings):
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FORMAT: str = Field(default="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    LOG_DATE_FORMAT: str = Field(default="%Y-%m-%d %H:%M:%S")
    LOG_FILE: Optional[str] = None
    LOG_FILE_MAX_BYTES: int = Field(default=10485760)
    LOG_FILE_BACKUP_COUNT: int = Field(default=5)
    LOG_JSON_FORMAT: bool = Field(default=False)
    LOG_INCLUDE_TRACE_ID: bool = Field(default=True)
    LOG_INCLUDE_USER_ID: bool = Field(default=True)
    LOG_INCLUDE_REQUEST_ID: bool = Field(default=True)
    LOG_SENSITIVE_FIELDS: List[str] = Field(default=["password", "token", "secret", "api_key", "access_token", "refresh_token", "ssn", "tax_id"])
    LOG_REQUEST_BODY: bool = Field(default=False)
    LOG_RESPONSE_BODY: bool = Field(default=False)
    LOG_SLOW_REQUEST_THRESHOLD: float = Field(default=1.0)
    SENTRY_DSN: Optional[str] = None
    SENTRY_ENVIRONMENT: Optional[str] = None
    SENTRY_TRACES_SAMPLE_RATE: float = Field(default=0.1)
    SENTRY_PROFILES_SAMPLE_RATE: float = Field(default=0.1)
    
    class Config:
        env_prefix = ""


class CelerySettings(BaseSettings):
    CELERY_BROKER_URL: str = Field(default="redis://localhost:6379/1")
    CELERY_RESULT_BACKEND: str = Field(default="redis://localhost:6379/2")
    CELERY_TASK_SERIALIZER: str = Field(default="json")
    CELERY_RESULT_SERIALIZER: str = Field(default="json")
    CELERY_ACCEPT_CONTENT: List[str] = Field(default=["json"])
    CELERY_TIMEZONE: str = Field(default="America/Chicago")
    CELERY_ENABLE_UTC: bool = Field(default=True)
    CELERY_TASK_TRACK_STARTED: bool = Field(default=True)
    CELERY_TASK_TIME_LIMIT: int = Field(default=300)
    CELERY_TASK_SOFT_TIME_LIMIT: int = Field(default=240)
    CELERY_WORKER_PREFETCH_MULTIPLIER: int = Field(default=4)
    CELERY_WORKER_CONCURRENCY: int = Field(default=4)
    CELERY_WORKER_MAX_TASKS_PER_CHILD: int = Field(default=1000)
    CELERY_TASK_ACKS_LATE: bool = Field(default=True)
    CELERY_TASK_REJECT_ON_WORKER_LOST: bool = Field(default=True)
    CELERY_TASK_DEFAULT_QUEUE: str = Field(default="default")
    CELERY_TASK_QUEUES: Dict[str, Dict[str, str]] = Field(default={
        "default": {"exchange": "default", "routing_key": "default"},
        "high_priority": {"exchange": "high_priority", "routing_key": "high_priority"},
        "low_priority": {"exchange": "low_priority", "routing_key": "low_priority"},
        "ai": {"exchange": "ai", "routing_key": "ai"},
        "email": {"exchange": "email", "routing_key": "email"},
        "plaid": {"exchange": "plaid", "routing_key": "plaid"},
    })
    CELERY_BEAT_SCHEDULE: Dict[str, Dict[str, Any]] = Field(default={
        "sync-plaid-transactions": {"task": "app.workers.tasks.plaid.sync_all_transactions", "schedule": 3600},
        "send-tax-reminders": {"task": "app.workers.tasks.notifications.send_tax_deadline_reminders", "schedule": 86400},
        "generate-weekly-summaries": {"task": "app.workers.tasks.reports.generate_weekly_summaries", "schedule": 604800},
        "cleanup-old-sessions": {"task": "app.workers.tasks.maintenance.cleanup_sessions", "schedule": 86400},
        "update-recurring-transactions": {"task": "app.workers.tasks.transactions.detect_recurring", "schedule": 86400},
        "refresh-ai-insights": {"task": "app.workers.tasks.ai.refresh_user_insights", "schedule": 21600},
    })
    
    class Config:
        env_prefix = ""


class FeatureFlags(BaseSettings):
    ENABLE_AI_FEATURES: bool = Field(default=True)
    ENABLE_AUTO_CATEGORIZATION: bool = Field(default=True)
    ENABLE_CASH_FLOW_FORECASTING: bool = Field(default=True)
    ENABLE_TAX_OPTIMIZATION: bool = Field(default=True)
    ENABLE_INVOICE_TRACKING: bool = Field(default=True)
    ENABLE_RECEIPT_SCANNING: bool = Field(default=True)
    ENABLE_MULTI_AGENT_SYSTEM: bool = Field(default=True)
    ENABLE_PREDICTIVE_ALERTS: bool = Field(default=True)
    ENABLE_WHAT_IF_ANALYSIS: bool = Field(default=True)
    ENABLE_CLIENT_PAYMENT_PREDICTION: bool = Field(default=True)
    ENABLE_EXPENSE_OPTIMIZATION: bool = Field(default=True)
    ENABLE_TAX_LOSS_HARVESTING: bool = Field(default=False)
    ENABLE_INVESTMENT_TRACKING: bool = Field(default=False)
    ENABLE_CRYPTO_TRACKING: bool = Field(default=False)
    ENABLE_INTERNATIONAL_TAXES: bool = Field(default=False)
    ENABLE_TEAM_COLLABORATION: bool = Field(default=False)
    ENABLE_API_ACCESS: bool = Field(default=True)
    ENABLE_WEBHOOKS: bool = Field(default=True)
    ENABLE_EXPORT_PDF: bool = Field(default=True)
    ENABLE_EXPORT_CSV: bool = Field(default=True)
    ENABLE_EXPORT_EXCEL: bool = Field(default=True)
    ENABLE_MOBILE_PUSH: bool = Field(default=False)
    ENABLE_SMS_NOTIFICATIONS: bool = Field(default=False)
    ENABLE_SLACK_INTEGRATION: bool = Field(default=False)
    ENABLE_QUICKBOOKS_IMPORT: bool = Field(default=False)
    ENABLE_STRIPE_INTEGRATION: bool = Field(default=False)
    ENABLE_PAYPAL_INTEGRATION: bool = Field(default=False)
    ENABLE_BETA_FEATURES: bool = Field(default=False)
    
    class Config:
        env_prefix = ""


class ChicagoSettings(BaseSettings):
    CHICAGO_BUSINESS_LICENSE_THRESHOLD: float = Field(default=4000)
    CHICAGO_SMALL_BUSINESS_TAX_RATE: float = Field(default=0.0)
    COOK_COUNTY_TAX_RATE: float = Field(default=0.0175)
    CHICAGO_SALES_TAX_RATE: float = Field(default=0.1025)
    CHICAGO_MIN_WAGE_2024: float = Field(default=15.80)
    ILLINOIS_MIN_WAGE_2024: float = Field(default=14.00)
    CHICAGO_SICK_LEAVE_HOURS: int = Field(default=40)
    CHICAGO_BUSINESS_DISTRICTS: List[str] = Field(default=[
        "Loop", "River North", "West Loop", "Fulton Market", "Wicker Park",
        "Lincoln Park", "Lakeview", "Gold Coast", "Streeterville", "South Loop"
    ])
    CHICAGO_INDUSTRY_CODES: Dict[str, str] = Field(default={
        "freelance_writer": "711510",
        "graphic_designer": "541430",
        "web_developer": "541511",
        "consultant": "541611",
        "photographer": "541921",
        "videographer": "512110",
        "marketing": "541810",
        "accounting": "541211",
        "legal": "541110",
        "real_estate": "531210"
    })
    
    class Config:
        env_prefix = ""


class Settings(BaseSettings):
    APP_NAME: str = Field(default="Chicago Fintech Platform")
    APP_VERSION: str = Field(default="2.0.0")
    APP_DESCRIPTION: str = Field(default="AI-Powered Autonomous Financial Management for Chicago Freelancers")
    DEBUG: bool = Field(default=False)
    ENVIRONMENT: str = Field(default="development")
    API_V1_PREFIX: str = Field(default="/api/v1")
    ALLOWED_HOSTS: List[str] = Field(default=["*"])
    CORS_ORIGINS: List[str] = Field(default=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"])
    CORS_ALLOW_CREDENTIALS: bool = Field(default=True)
    CORS_ALLOW_METHODS: List[str] = Field(default=["*"])
    CORS_ALLOW_HEADERS: List[str] = Field(default=["*"])
    CORS_EXPOSE_HEADERS: List[str] = Field(default=["X-Request-ID", "X-Process-Time", "X-RateLimit-Limit", "X-RateLimit-Remaining"])
    CORS_MAX_AGE: int = Field(default=600)
    BACKEND_WORKERS: int = Field(default=4)
    BACKEND_TIMEOUT: int = Field(default=120)
    BACKEND_KEEPALIVE: int = Field(default=5)
    BACKEND_MAX_REQUESTS: int = Field(default=10000)
    BACKEND_MAX_REQUESTS_JITTER: int = Field(default=1000)
    REQUEST_TIMEOUT: int = Field(default=60)
    RESPONSE_COMPRESSION: bool = Field(default=True)
    RESPONSE_COMPRESSION_MIN_SIZE: int = Field(default=500)
    HEALTH_CHECK_PATH: str = Field(default="/health")
    METRICS_PATH: str = Field(default="/metrics")
    DOCS_URL: str = Field(default="/api/v1/docs")
    REDOC_URL: str = Field(default="/api/v1/redoc")
    OPENAPI_URL: str = Field(default="/api/v1/openapi.json")
    BASE_URL: str = Field(default="http://localhost:8000")
    FRONTEND_URL: str = Field(default="http://localhost:5173")
    
    db: DatabaseSettings = Field(default_factory=DatabaseSettings)
    redis: RedisSettings = Field(default_factory=RedisSettings)
    security: SecuritySettings = Field(default_factory=SecuritySettings)
    plaid: PlaidSettings = Field(default_factory=PlaidSettings)
    openai: OpenAISettings = Field(default_factory=OpenAISettings)
    email: EmailSettings = Field(default_factory=EmailSettings)
    tax: TaxSettings = Field(default_factory=TaxSettings)
    cache: CacheSettings = Field(default_factory=CacheSettings)
    rate_limit: RateLimitSettings = Field(default_factory=RateLimitSettings)
    logging: LoggingSettings = Field(default_factory=LoggingSettings)
    celery: CelerySettings = Field(default_factory=CelerySettings)
    features: FeatureFlags = Field(default_factory=FeatureFlags)
    chicago: ChicagoSettings = Field(default_factory=ChicagoSettings)
    
    @validator("ENVIRONMENT")
    def validate_environment(cls, v):
        allowed = ["development", "staging", "production", "testing"]
        if v not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}")
        return v
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"
    
    @property
    def is_testing(self) -> bool:
        return self.ENVIRONMENT == "testing"
    
    @property
    def show_docs(self) -> bool:
        return not self.is_production or self.DEBUG
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        env_nested_delimiter = "__"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
