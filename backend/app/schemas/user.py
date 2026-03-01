"""User schemas."""
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field
from uuid import UUID


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=255)
    phone: Optional[str] = None
    business_name: Optional[str] = None
    business_type: str = "freelancer"
    industry_category: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    business_name: Optional[str] = None
    business_type: Optional[str] = None
    industry_category: Optional[str] = None
    tax_filing_status: Optional[str] = None
    chicago_community_area: Optional[str] = None
    zip_code: Optional[str] = None
    notification_preferences: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    is_verified: bool
    tax_filing_status: Optional[str] = None
    state_of_residence: str = "IL"
    chicago_community_area: Optional[str] = None
    zip_code: Optional[str] = None
    onboarding_completed: bool = False
    subscription_tier: str = "free"
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserProfile(UserResponse):
    notification_preferences: Dict[str, Any] = {}
    dashboard_preferences: Dict[str, Any] = {}
    last_login_at: Optional[datetime] = None
