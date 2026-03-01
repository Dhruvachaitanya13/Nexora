from datetime import datetime, timedelta
from typing import Any, Optional
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field, validator

from app.api.deps import get_db, get_current_user, get_current_active_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    verify_password,
    get_password_hash,
    verify_token,
    generate_password_reset_token,
    verify_password_reset_token,
    TwoFactorAuth,
    check_password_strength,
    TokenType,
)
from app.models.user import User, UserStatus, OnboardingStep

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=255)
    business_type: Optional[str] = "freelancer"
    
    @validator("password")
    def validate_password(cls, v):
        strength = check_password_strength(v)
        if strength.score < 3:
            raise ValueError(f"Password too weak: {', '.join(strength['feedback'])}")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False
    two_factor_code: Optional[str] = None


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class TokenRefresh(BaseModel):
    refresh_token: str


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class TwoFactorSetup(BaseModel):
    password: str


class TwoFactorVerify(BaseModel):
    code: str


class TwoFactorDisable(BaseModel):
    password: str
    code: str


class EmailVerify(BaseModel):
    token: str


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    existing = db.query(User).filter(User.email == user_data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    user = User(
        email=user_data.email.lower(),
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        business_type=user_data.business_type,
        status=UserStatus.PENDING_VERIFICATION,
        is_active=True,
        is_verified=False,
    )
    
    user.verification_token = secrets.token_urlsafe(32)
    user.verification_token_expires = datetime.utcnow() + timedelta(hours=24)
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token_pair = create_token_pair(
        subject=str(user.id),
        scopes=["user"],
    )
    
    return {
        "access_token": token_pair.access_token,
        "refresh_token": token_pair.refresh_token,
        "token_type": "bearer",
        "expires_in": settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user.to_public_dict(),
    }


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    request: Request = None,
) -> Any:
    user = db.query(User).filter(User.email == form_data.username.lower()).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if user.is_account_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked. Try again later.",
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        user.record_failed_login()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is inactive",
        )
    
    client_ip = request.client.host if request else None
    user.record_login(ip_address=client_ip)
    db.commit()
    
    token_pair = create_token_pair(
        subject=str(user.id),
        scopes=["user"],
    )
    
    return {
        "access_token": token_pair.access_token,
        "refresh_token": token_pair.refresh_token,
        "token_type": "bearer",
        "expires_in": settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user.to_public_dict(),
    }


@router.post("/login/json", response_model=Token)
async def login_json(
    login_data: UserLogin,
    db: Session = Depends(get_db),
    request: Request = None,
) -> Any:
    user = db.query(User).filter(User.email == login_data.email.lower()).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if user.is_account_locked:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account locked due to too many failed attempts",
        )
    
    if not verify_password(login_data.password, user.hashed_password):
        user.record_failed_login()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if user.two_factor_enabled:
        if not login_data.two_factor_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Two-factor authentication code required",
                headers={"X-2FA-Required": "true"},
            )
        
        tfa = TwoFactorAuth()
        if not tfa.verify_totp(user.two_factor_secret, login_data.two_factor_code):
            if login_data.two_factor_code not in (user.two_factor_backup_codes or []):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid two-factor authentication code",
                )
            user.two_factor_backup_codes.remove(login_data.two_factor_code)
    
    client_ip = request.client.host if request else None
    user.record_login(ip_address=client_ip)
    db.commit()
    
    expire_minutes = settings.security.ACCESS_TOKEN_EXPIRE_MINUTES
    if login_data.remember_me:
        expire_minutes = expire_minutes * 7
    
    token_pair = create_token_pair(
        subject=str(user.id),
        scopes=["user"],
        expires_delta=timedelta(minutes=expire_minutes),
    )
    
    return {
        "access_token": token_pair.access_token,
        "refresh_token": token_pair.refresh_token,
        "token_type": "bearer",
        "expires_in": expire_minutes * 60,
        "user": user.to_full_dict(),
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_data: TokenRefresh,
    db: Session = Depends(get_db),
) -> Any:
    try:
        payload = verify_token(token_data.refresh_token, token_type=TokenType.REFRESH)
        user_id = payload.user_id
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    
    token_pair = create_token_pair(
        subject=str(user.id),
        scopes=["user"],
    )
    
    return {
        "access_token": token_pair.access_token,
        "refresh_token": token_pair.refresh_token,
        "token_type": "bearer",
        "expires_in": settings.security.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": user.to_public_dict(),
    }


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
) -> Any:
    return {"message": "Successfully logged out"}


@router.post("/password-reset")
async def request_password_reset(
    reset_data: PasswordReset,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(User).filter(User.email == reset_data.email.lower()).first()
    
    if user:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()
    
    return {"message": "If the email exists, a password reset link has been sent"}


@router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(User).filter(
        User.password_reset_token == reset_data.token,
        User.password_reset_expires > datetime.utcnow(),
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )
    
    strength = check_password_strength(reset_data.new_password)
    if strength.score < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password too weak: {', '.join(strength['feedback'])}",
        )
    
    user.hashed_password = get_password_hash(reset_data.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.password_changed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Password has been reset successfully"}


@router.post("/password-change")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    
    strength = check_password_strength(password_data.new_password)
    if strength.score < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Password too weak: {', '.join(strength['feedback'])}",
        )
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.password_changed_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/verify-email")
async def verify_email(
    verify_data: EmailVerify,
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(User).filter(
        User.verification_token == verify_data.token,
        User.verification_token_expires > datetime.utcnow(),
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )
    
    user.is_verified = True
    user.email_verified_at = datetime.utcnow()
    user.status = UserStatus.ACTIVE
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()
    
    return {"message": "Email verified successfully"}


@router.post("/2fa/setup")
async def setup_two_factor(
    setup_data: TwoFactorSetup,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    if not verify_password(setup_data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )
    
    if current_user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication is already enabled",
        )
    
    tfa = TwoFactorAuth()
    secret = tfa.generate_secret()
    qr_uri = tfa.get_provisioning_uri(secret, current_user.email, "Nexora")
    backup_codes = tfa.generate_backup_codes()
    
    current_user.two_factor_secret = secret
    current_user.two_factor_backup_codes = backup_codes
    db.commit()
    
    return {
        "secret": secret,
        "qr_uri": qr_uri,
        "backup_codes": backup_codes,
    }


@router.post("/2fa/verify")
async def verify_two_factor(
    verify_data: TwoFactorVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    if not current_user.two_factor_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Two-factor authentication not set up",
        )
    
    tfa = TwoFactorAuth()
    if not tfa.verify_totp(current_user.two_factor_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )
    
    current_user.two_factor_enabled = True
    current_user.two_factor_verified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Two-factor authentication enabled successfully"}


@router.post("/2fa/disable")
async def disable_two_factor(
    disable_data: TwoFactorDisable,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    if not verify_password(disable_data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password",
        )
    
    tfa = TwoFactorAuth()
    if not tfa.verify_totp(current_user.two_factor_secret, disable_data.code):
        if disable_data.code not in (current_user.two_factor_backup_codes or []):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )
    
    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    current_user.two_factor_backup_codes = None
    current_user.two_factor_verified_at = None
    db.commit()
    
    return {"message": "Two-factor authentication disabled"}


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user.to_full_dict()
