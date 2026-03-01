"""Account schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID


class AccountBase(BaseModel):
    institution_name: str
    account_name: Optional[str] = None
    account_type: Optional[str] = None
    account_subtype: Optional[str] = None


class AccountResponse(AccountBase):
    id: UUID
    institution_id: Optional[str] = None
    institution_logo: Optional[str] = None
    account_mask: Optional[str] = None
    current_balance: Optional[float] = None
    available_balance: Optional[float] = None
    credit_limit: Optional[float] = None
    iso_currency_code: str = "USD"
    sync_status: str
    last_sync_at: Optional[datetime] = None
    is_primary_checking: bool = False
    is_hidden: bool = False
    created_at: datetime
    
    class Config:
        from_attributes = True


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    is_primary_checking: Optional[bool] = None
    is_tax_account: Optional[bool] = None
    is_hidden: Optional[bool] = None


class AccountSummary(BaseModel):
    total_accounts: int
    total_balance: float
    checking_balance: float
    savings_balance: float
    credit_used: float
    credit_available: float
    accounts: List[AccountResponse]
