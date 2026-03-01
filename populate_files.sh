#!/bin/bash

# ===========================================
# CHICAGO FINTECH - POPULATE ALL FILES
# Run this from inside your project folder
# ===========================================

echo "📝 Populating all project files with code..."

# ===========================================
# REQUIREMENTS
# ===========================================
cat > backend/requirements/base.txt << 'EOF'
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
sqlalchemy==2.0.25
asyncpg==0.29.0
alembic==1.13.1
psycopg2-binary==2.9.9
redis==5.0.1
celery==5.3.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
httpx==0.26.0
plaid-python==17.4.0
python-dotenv==1.0.0
structlog==24.1.0
cryptography==41.0.7
prometheus-client==0.19.0
EOF

cat > backend/requirements/ml.txt << 'EOF'
numpy==1.26.3
pandas==2.1.4
scikit-learn==1.4.0
xgboost==2.0.3
openai==1.7.2
langchain==0.1.0
langchain-openai==0.0.2
mlflow==2.9.2
EOF

cat > backend/requirements/dev.txt << 'EOF'
-r base.txt
-r ml.txt
pytest==7.4.4
pytest-asyncio==0.23.3
black==23.12.1
isort==5.13.2
mypy==1.8.0
EOF

# ===========================================
# DOCKER COMPOSE
# ===========================================
cat > docker-compose.yml << 'EOF'
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: fintech-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: fintech_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./infrastructure/docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: fintech-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mlflow:
    image: python:3.11-slim
    container_name: fintech-mlflow
    ports:
      - "5000:5000"
    volumes:
      - mlflow_data:/mlflow
    command: >
      bash -c "pip install mlflow==2.9.2 && 
      mlflow server --host 0.0.0.0 --port 5000 --backend-store-uri sqlite:///mlflow/mlflow.db --default-artifact-root /mlflow/artifacts"

volumes:
  postgres_data:
  redis_data:
  mlflow_data:
EOF

# ===========================================
# POSTGRES INIT
# ===========================================
cat > infrastructure/docker/postgres/init.sql << 'EOF'
CREATE DATABASE fintech_dev;
CREATE DATABASE fintech_test;
\c fintech_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOF

# ===========================================
# MAKEFILE
# ===========================================
cat > Makefile << 'EOF'
.PHONY: help up down logs dev test install migrate

help:
	@echo "make up      - Start Docker services"
	@echo "make down    - Stop Docker services"  
	@echo "make dev     - Start dev server"
	@echo "make install - Install dependencies"
	@echo "make migrate - Run migrations"

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

dev:
	docker-compose up -d postgres redis
	@sleep 3
	cd backend && uvicorn app.main:app --reload --port 8000

install:
	cd backend && pip install -r requirements/dev.txt

migrate:
	cd backend && alembic upgrade head

migrate-new:
	cd backend && alembic revision --autogenerate -m "$(msg)"
EOF

# ===========================================
# BACKEND APP __init__.py
# ===========================================
cat > backend/app/__init__.py << 'EOF'
"""Chicago Fintech Platform"""
__version__ = "0.1.0"
EOF

# ===========================================
# CORE CONFIG
# ===========================================
cat > backend/app/core/__init__.py << 'EOF'
from app.core.config import settings
EOF

cat > backend/app/core/config.py << 'EOF'
from typing import List, Optional
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")
    
    APP_NAME: str = "chicago-fintech-platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = Field(default="change-me-to-32-char-secret-key!")
    API_VERSION: str = "v1"
    ALLOWED_HOSTS: str = "localhost,127.0.0.1"
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/fintech_dev"
    DATABASE_URL_SYNC: Optional[str] = "postgresql://postgres:postgres@localhost:5432/fintech_dev"
    
    REDIS_URL: str = "redis://localhost:6379/0"
    
    PLAID_CLIENT_ID: Optional[str] = None
    PLAID_SECRET: Optional[str] = None
    PLAID_ENV: str = "sandbox"
    
    OPENAI_API_KEY: Optional[str] = None
    
    JWT_SECRET_KEY: str = Field(default="change-me-jwt-secret-32-chars!!")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    MLFLOW_TRACKING_URI: str = "http://localhost:5000"
    
    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
EOF

# ===========================================
# DATABASE
# ===========================================
cat > backend/app/core/database.py << 'EOF'
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    from app.models.base import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
EOF

# ===========================================
# SECURITY
# ===========================================
cat > backend/app/core/security.py << 'EOF'
from datetime import datetime, timedelta
from typing import Any, Optional, Union
from jose import jwt
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64, hashlib
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    return jwt.encode({"sub": str(subject), "exp": expire}, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except:
        return None

def _get_key() -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())

_fernet = Fernet(_get_key())

def encrypt_token(text: str) -> str:
    return _fernet.encrypt(text.encode()).decode()

def decrypt_token(text: str) -> str:
    return _fernet.decrypt(text.encode()).decode()
EOF

# ===========================================
# EXCEPTIONS
# ===========================================
cat > backend/app/core/exceptions.py << 'EOF'
from typing import Any, Dict, Optional

class AppException(Exception):
    def __init__(self, message: str, status_code: int = 500, details: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}

class NotFoundError(AppException):
    def __init__(self, resource: str, id: Any):
        super().__init__(f"{resource} '{id}' not found", 404)

class AuthError(AppException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401)
EOF

# ===========================================
# MODELS
# ===========================================
cat > backend/app/models/__init__.py << 'EOF'
from app.models.base import Base, UUIDMixin, TimestampMixin
from app.models.user import User
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction
from app.models.category import Category
EOF

cat > backend/app/models/base.py << 'EOF'
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, DateTime, MetaData
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, declared_attr

class Base(DeclarativeBase):
    metadata = MetaData(naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    })

class UUIDMixin:
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

class TimestampMixin:
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
EOF

cat > backend/app/models/user.py << 'EOF'
from sqlalchemy import Boolean, Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"
    
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20))
    business_name = Column(String(255))
    business_type = Column(String(100))
    tax_filing_status = Column(String(50))
    state_of_residence = Column(String(2), default="IL")
    chicago_community_area = Column(String(100))
    zip_code = Column(String(10))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    accounts = relationship("ConnectedAccount", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
EOF

cat > backend/app/models/account.py << 'EOF'
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class ConnectedAccount(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "connected_accounts"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plaid_item_id = Column(String(255), nullable=False)
    plaid_access_token = Column(Text, nullable=False)
    plaid_account_id = Column(String(255), nullable=False, unique=True)
    institution_name = Column(String(255), nullable=False)
    account_name = Column(String(255))
    account_type = Column(String(50))
    account_subtype = Column(String(50))
    current_balance = Column(Numeric(15, 2))
    available_balance = Column(Numeric(15, 2))
    last_sync_at = Column(DateTime(timezone=True))
    sync_status = Column(String(50), default="pending")
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
EOF

cat > backend/app/models/transaction.py << 'EOF'
from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin, UUIDMixin

class Transaction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "transactions"
    
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("connected_accounts.id", ondelete="CASCADE"), nullable=False)
    plaid_transaction_id = Column(String(255), unique=True)
    amount = Column(Numeric(15, 2), nullable=False)
    transaction_date = Column(Date, nullable=False)
    transaction_type = Column(String(50))
    merchant_name = Column(String(255))
    original_description = Column(Text)
    plaid_category = Column(String(255))
    final_category_id = Column(Integer, ForeignKey("categories.id"))
    is_business_expense = Column(Boolean, default=False)
    is_tax_deductible = Column(Boolean, default=False)
    is_income = Column(Boolean, default=False)
    is_recurring = Column(Boolean, default=False)
    is_pending = Column(Boolean, default=False)
    notes = Column(Text)
    tags = Column(ARRAY(String))
    
    user = relationship("User", back_populates="transactions")
    account = relationship("ConnectedAccount", back_populates="transactions")
EOF

cat > backend/app/models/category.py << 'EOF'
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from app.models.base import Base, TimestampMixin

class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    parent_category_id = Column(Integer, ForeignKey("categories.id"))
    category_name = Column(String(255), nullable=False)
    category_slug = Column(String(255), unique=True, nullable=False)
    is_typically_business = Column(Boolean, default=False)
    is_typically_deductible = Column(Boolean, default=False)
    irs_category = Column(String(100))
    icon = Column(String(50))
    color = Column(String(7))
    is_active = Column(Boolean, default=True)
    
    parent = relationship("Category", remote_side=[id], backref="subcategories")
EOF

echo "✅ Models created!"

# ===========================================
# API
# ===========================================
cat > backend/app/api/__init__.py << 'EOF'
"""API Package"""
EOF

cat > backend/app/api/deps.py << 'EOF'
from typing import AsyncGenerator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except:
            await session.rollback()
            raise

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    payload = decode_token(creds.credentials)
    if not payload:
        raise HTTPException(401, "Invalid token")
    result = await db.execute(select(User).where(User.id == payload.get("sub")))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    return user
EOF

cat > backend/app/api/v1/__init__.py << 'EOF'
"""API v1"""
EOF

cat > backend/app/api/v1/router.py << 'EOF'
from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, plaid, accounts, transactions

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(plaid.router, prefix="/plaid", tags=["Plaid"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
EOF

cat > backend/app/api/v1/endpoints/__init__.py << 'EOF'
"""Endpoints"""
EOF

# Auth endpoint
cat > backend/app/api/v1/endpoints/auth.py << 'EOF'
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User

router = APIRouter()

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")
    user = User(email=req.email, password_hash=hash_password(req.password), full_name=req.full_name)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id)))

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user.id)))

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {"id": str(user.id), "email": user.email, "full_name": user.full_name}
EOF

# Other endpoints (placeholders)
for ep in users plaid accounts transactions; do
cat > backend/app/api/v1/endpoints/${ep}.py << EOF
from fastapi import APIRouter, Depends
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

@router.get("/")
async def list_${ep}(user: User = Depends(get_current_user)):
    return {"message": "${ep} endpoint", "user_id": str(user.id)}
EOF
done

echo "✅ API endpoints created!"

# ===========================================
# MAIN APP
# ===========================================
cat > backend/app/main.py << 'EOF'
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app

from app.core.config import settings
from app.core.database import init_db
from app.core.exceptions import AppException
from app.api.v1.router import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🚀 Starting {settings.APP_NAME}")
    if settings.is_development:
        await init_db()
    yield
    print("👋 Shutting down")

app = FastAPI(
    title=settings.APP_NAME,
    description="AI-Powered Finance Platform for Chicago Freelancers",
    version="0.1.0",
    docs_url=f"/api/{settings.API_VERSION}/docs",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.exception_handler(AppException)
async def handle_app_exception(request: Request, exc: AppException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})

app.mount("/metrics", make_asgi_app())
app.include_router(api_router, prefix=f"/api/{settings.API_VERSION}")

@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "docs": f"/api/{settings.API_VERSION}/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
EOF

# ===========================================
# ALEMBIC
# ===========================================
cat > backend/alembic.ini << 'EOF'
[alembic]
script_location = migrations
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/fintech_dev

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =

[logger_alembic]
level = INFO
handlers =

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
EOF

cat > backend/migrations/env.py << 'EOF'
import os
from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from app.models.base import Base
from app.models import *

config = context.config
db_url = os.getenv("DATABASE_URL_SYNC", config.get_main_option("sqlalchemy.url"))
config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=db_url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOF

cat > backend/migrations/script.py.mako << 'EOF'
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}

def upgrade():
    ${upgrades if upgrades else "pass"}

def downgrade():
    ${downgrades if downgrades else "pass"}
EOF

# Create placeholder files
touch backend/app/services/__init__.py
touch backend/app/services/plaid/__init__.py
touch backend/app/services/tax/__init__.py
touch backend/app/services/ml/__init__.py
touch backend/app/services/ai/__init__.py
touch backend/app/services/chicago/__init__.py
touch backend/app/utils/__init__.py
touch backend/app/schemas/__init__.py
touch backend/app/workers/__init__.py

echo ""
echo "==========================================="
echo "✅ ALL FILES POPULATED!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "1. Copy .env file to project root"
echo "2. Run: make install"
echo "3. Run: make up"
echo "4. Run: cd backend && alembic revision --autogenerate -m 'Initial'"
echo "5. Run: cd backend && alembic upgrade head"
echo "6. Run: make dev"
echo "7. Open: http://localhost:8000/api/v1/docs"
