"""API Dependencies."""
from typing import Generator, Optional
from datetime import datetime
import logging

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, APIKeyHeader
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Get current authenticated user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    from app.core.security import verify_token
    from app.models.user import User
    
    try:
        payload = verify_token(token)
        user_id = payload.user_id
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
            )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return user


async def get_current_active_user(current_user=Depends(get_current_user)):
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )
    return current_user


async def get_current_superuser(current_user=Depends(get_current_user)):
    """Get current superuser."""
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


async def get_optional_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
):
    """Get current user if authenticated, None otherwise."""
    if not token:
        return None
    
    from app.core.security import verify_token
    from app.models.user import User
    
    try:
        payload = verify_token(token)
        user_id = payload.user_id
        if user_id is None:
            return None
        user = db.query(User).filter(User.id == user_id).first()
        return user
    except Exception:
        return None


async def get_user_by_api_key(
    db: Session = Depends(get_db),
    api_key: str = Depends(api_key_header),
):
    """Get user by API key."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
        )
    
    from app.core.security import hash_api_key
    from app.models.user import User, APIKey
    
    hashed_key = hash_api_key(api_key)
    api_key_obj = db.query(APIKey).filter(
        APIKey.key_hash == hashed_key,
        APIKey.is_active == True,
    ).first()
    
    if not api_key_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    
    # Update usage
    api_key_obj.last_used_at = datetime.utcnow()
    api_key_obj.usage_count += 1
    db.commit()
    
    return api_key_obj.user


def get_ai_engine(db: Session = Depends(get_db)):
    """Get AI engine instance."""
    from app.services.ai.engine import AIEngine
    return AIEngine(db=db)


def get_agent_orchestrator(
    db: Session = Depends(get_db),
    engine=Depends(get_ai_engine),
):
    """Get agent orchestrator instance."""
    from app.services.ai.agent_orchestrator import AgentOrchestrator
    return AgentOrchestrator(engine=engine, db=db)


async def get_financial_context(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get financial context for current user."""
    from app.services.ai.context import FinancialContextBuilder
    builder = FinancialContextBuilder(db)
    return await builder.build(current_user)


def check_feature_access(feature: str):
    """Check if user has access to a feature based on subscription tier."""
    async def _check(current_user=Depends(get_current_user)):
        # Feature access mapping by tier
        feature_tiers = {
            "ai_chat": ["free", "pro", "premium", "enterprise"],
            "ai_insights": ["pro", "premium", "enterprise"],
            "forecasting": ["pro", "premium", "enterprise"],
            "tax_optimization": ["pro", "premium", "enterprise"],
            "automations": ["premium", "enterprise"],
            "api_access": ["premium", "enterprise"],
            "priority_support": ["enterprise"],
        }
        
        allowed_tiers = feature_tiers.get(feature, ["free", "pro", "premium", "enterprise"])
        user_tier = getattr(current_user, 'subscription_tier', None)
        
        if user_tier is None:
            user_tier = "free"
        elif hasattr(user_tier, 'value'):
            user_tier = user_tier.value
        
        if user_tier not in allowed_tiers:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature}' requires a higher subscription tier",
            )
        
        return current_user
    
    return _check


class RateLimitDep:
    """Rate limiting dependency."""
    
    def __init__(self, requests: int = 100, period: int = 60):
        self.requests = requests
        self.period = period
    
    async def __call__(self, current_user=Depends(get_current_user)):
        # Rate limiting logic would go here
        # For now, just return the user
        return current_user