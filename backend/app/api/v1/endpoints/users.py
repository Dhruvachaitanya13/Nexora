from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_db, get_current_user, get_current_superuser
from app.core.security import get_password_hash
from app.models.user import User, BusinessType, SubscriptionTier, FilingStatus, OnboardingStep

router = APIRouter()


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    timezone: Optional[str] = None
    locale: Optional[str] = None
    currency: Optional[str] = None
    
    business_type: Optional[str] = None
    business_name: Optional[str] = None
    business_description: Optional[str] = None
    business_website: Optional[str] = None
    industry: Optional[str] = None
    
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    
    filing_status: Optional[str] = None
    estimated_annual_income: Optional[float] = None
    tax_reserve_percentage: Optional[float] = Field(None, ge=0, le=100)
    
    monthly_income_goal: Optional[float] = None
    monthly_expense_budget: Optional[float] = None
    monthly_savings_goal: Optional[float] = None
    emergency_fund_goal: Optional[float] = None


class UserPreferences(BaseModel):
    theme: Optional[str] = None
    language: Optional[str] = None
    date_format: Optional[str] = None
    time_format: Optional[str] = None
    currency_display: Optional[str] = None
    dashboard_layout: Optional[str] = None
    auto_categorization: Optional[bool] = None
    ai_suggestions: Optional[bool] = None


class NotificationSettings(BaseModel):
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None
    sms_notifications: Optional[bool] = None
    tax_deadline_reminders: Optional[bool] = None
    weekly_summary: Optional[bool] = None
    monthly_report: Optional[bool] = None
    transaction_alerts: Optional[bool] = None
    low_balance_alerts: Optional[bool] = None
    low_balance_threshold: Optional[float] = None
    invoice_reminders: Optional[bool] = None
    ai_insights: Optional[bool] = None


class OnboardingUpdate(BaseModel):
    step: str
    data: Optional[dict] = None


@router.get("/me", response_model=dict)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user.to_full_dict()


@router.put("/me", response_model=dict)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    update_data = user_data.dict(exclude_unset=True)
    
    if "business_type" in update_data:
        try:
            update_data["business_type"] = BusinessType(update_data["business_type"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid business type",
            )
    
    if "filing_status" in update_data:
        try:
            update_data["filing_status"] = FilingStatus(update_data["filing_status"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid filing status",
            )
    
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    db.commit()
    db.refresh(current_user)
    
    return current_user.to_full_dict()


@router.get("/me/preferences", response_model=dict)
async def get_user_preferences(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user.preferences or {}


@router.put("/me/preferences", response_model=dict)
async def update_user_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    update_data = preferences.dict(exclude_unset=True)
    
    if not current_user.preferences:
        current_user.preferences = {}
    
    for key, value in update_data.items():
        current_user.preferences[key] = value
    
    db.commit()
    db.refresh(current_user)
    
    return current_user.preferences


@router.get("/me/notifications", response_model=dict)
async def get_notification_settings(
    current_user: User = Depends(get_current_user),
) -> Any:
    return current_user.notification_settings or {}


@router.put("/me/notifications", response_model=dict)
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    update_data = settings.dict(exclude_unset=True)
    
    if not current_user.notification_settings:
        current_user.notification_settings = {}
    
    for key, value in update_data.items():
        current_user.notification_settings[key] = value
    
    db.commit()
    db.refresh(current_user)
    
    return current_user.notification_settings


@router.post("/me/onboarding", response_model=dict)
async def update_onboarding(
    onboarding: OnboardingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    try:
        step = OnboardingStep(onboarding.step)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid onboarding step",
        )
    
    current_user.onboarding_step = step
    
    if step == OnboardingStep.COMPLETED:
        current_user.complete_onboarding()
    
    if onboarding.data:
        if not current_user.metadata:
            current_user.metadata = {}
        current_user.metadata["onboarding_data"] = onboarding.data
    
    db.commit()
    db.refresh(current_user)
    
    return {
        "onboarding_step": current_user.onboarding_step.value,
        "onboarding_completed": current_user.onboarding_completed,
    }


@router.get("/me/subscription", response_model=dict)
async def get_subscription_info(
    current_user: User = Depends(get_current_user),
) -> Any:
    return {
        "tier": current_user.subscription_tier.value,
        "status": current_user.subscription_status,
        "is_premium": current_user.is_premium,
        "is_trial": current_user.is_trial_active,
        "expires_at": current_user.subscription_expires_at.isoformat() if current_user.subscription_expires_at else None,
        "days_until_expiration": current_user.days_until_subscription_expires,
        "trial_ends_at": current_user.trial_ends_at.isoformat() if current_user.trial_ends_at else None,
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    current_user.soft_delete()
    current_user.is_active = False
    current_user.email = f"deleted_{current_user.id}@deleted.local"
    db.commit()


@router.get("/{user_id}", response_model=dict)
async def get_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_superuser),
    db: Session = Depends(get_db),
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user.to_full_dict()
