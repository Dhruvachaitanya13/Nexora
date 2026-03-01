"""Plaid schemas."""
from typing import List, Optional
from pydantic import BaseModel


class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str
    request_id: Optional[str] = None


class ExchangeTokenRequest(BaseModel):
    public_token: str
    institution_id: str
    institution_name: str


class ExchangeTokenResponse(BaseModel):
    success: bool
    accounts_linked: int
    accounts: List[dict]


class SyncTransactionsResponse(BaseModel):
    added: int
    modified: int
    removed: int
    cursor: Optional[str] = None
