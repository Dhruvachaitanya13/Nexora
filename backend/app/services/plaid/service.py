"""Plaid service for bank account integration."""
from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID
import logging

from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from plaid.exceptions import ApiException

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.security import encrypt_token, decrypt_token
from app.models.account import ConnectedAccount
from app.models.transaction import Transaction
from app.services.plaid.client import plaid_client

logger = logging.getLogger(__name__)


class PlaidService:
    """Service for Plaid API operations."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.client = plaid_client.client
    
    async def create_link_token(self, user_id: UUID) -> Dict[str, Any]:
        """Create a Link token for Plaid Link."""
        try:
            request = LinkTokenCreateRequest(
                user=LinkTokenCreateRequestUser(client_user_id=str(user_id)),
                client_name="Chicago Fintech Platform",
                products=[Products("transactions")],
                country_codes=[CountryCode("US")],
                language="en",
            )
            response = self.client.link_token_create(request)
            return {
                "link_token": response.link_token,
                "expiration": str(response.expiration),
            }
        except ApiException as e:
            logger.error(f"Plaid link token error: {e}")
            raise Exception(f"Plaid error: {e.body}")
    
    async def exchange_public_token(
        self,
        user_id: UUID,
        public_token: str,
        institution_id: str,
        institution_name: str,
    ) -> List[ConnectedAccount]:
        """Exchange public token for access token and save accounts."""
        try:
            exchange_request = ItemPublicTokenExchangeRequest(public_token=public_token)
            exchange_response = self.client.item_public_token_exchange(exchange_request)
            
            access_token = exchange_response.access_token
            item_id = exchange_response.item_id
            
            accounts_request = AccountsGetRequest(access_token=access_token)
            accounts_response = self.client.accounts_get(accounts_request)
            
            connected_accounts = []
            for acct in accounts_response.accounts:
                existing = await self.db.execute(
                    select(ConnectedAccount).where(
                        ConnectedAccount.plaid_account_id == acct.account_id
                    )
                )
                if existing.scalar_one_or_none():
                    continue
                
                # Get type values safely
                acct_type = None
                if acct.type:
                    acct_type = acct.type.value if hasattr(acct.type, 'value') else str(acct.type)
                
                acct_subtype = None
                if acct.subtype:
                    acct_subtype = acct.subtype.value if hasattr(acct.subtype, 'value') else str(acct.subtype)
                
                account = ConnectedAccount(
                    user_id=user_id,
                    plaid_item_id=item_id,
                    plaid_access_token=encrypt_token(access_token),
                    plaid_account_id=acct.account_id,
                    plaid_cursor="",
                    institution_id=institution_id,
                    institution_name=institution_name,
                    account_name=acct.name,
                    official_name=acct.official_name,
                    account_mask=acct.mask,
                    account_type=acct_type,
                    account_subtype=acct_subtype,
                    current_balance=float(acct.balances.current) if acct.balances.current else None,
                    available_balance=float(acct.balances.available) if acct.balances.available else None,
                    credit_limit=float(acct.balances.limit) if acct.balances.limit else None,
                    iso_currency_code=acct.balances.iso_currency_code or "USD",
                    sync_status="active",
                    last_sync_at=datetime.utcnow(),
                )
                self.db.add(account)
                connected_accounts.append(account)
            
            await self.db.commit()
            for account in connected_accounts:
                await self.db.refresh(account)
            
            return connected_accounts
            
        except ApiException as e:
            logger.error(f"Plaid exchange error: {e}")
            raise Exception(f"Plaid error: {e.body}")
    
    async def sync_transactions(self, account_id: UUID, days: int = 90) -> Dict[str, Any]:
        """Sync transactions for an account."""
        result = await self.db.execute(
            select(ConnectedAccount).where(ConnectedAccount.id == account_id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            raise Exception(f"Account {account_id} not found")
        
        access_token = decrypt_token(account.plaid_access_token)
        
        try:
            added_count = 0
            cursor = account.plaid_cursor if account.plaid_cursor else ""
            has_more = True
            
            while has_more:
                if cursor:
                    request = TransactionsSyncRequest(
                        access_token=access_token,
                        cursor=cursor,
                    )
                else:
                    request = TransactionsSyncRequest(
                        access_token=access_token,
                    )
                
                response = self.client.transactions_sync(request)
                
                for txn in response.added:
                    existing = await self.db.execute(
                        select(Transaction).where(
                            Transaction.plaid_transaction_id == txn.transaction_id
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue
                    
                    is_income = txn.amount < 0
                    
                    # Get payment_channel safely
                    payment_channel = None
                    if txn.payment_channel:
                        payment_channel = txn.payment_channel.value if hasattr(txn.payment_channel, 'value') else str(txn.payment_channel)
                    
                    # Get category safely
                    category_str = None
                    if txn.category:
                        category_str = ", ".join(txn.category) if isinstance(txn.category, list) else str(txn.category)
                    
                    transaction = Transaction(
                        user_id=account.user_id,
                        account_id=account.id,
                        plaid_transaction_id=txn.transaction_id,
                        amount=abs(float(txn.amount)),
                        transaction_date=txn.date,
                        authorized_date=txn.authorized_date,
                        transaction_type="credit" if is_income else "debit",
                        payment_channel=payment_channel,
                        merchant_name=txn.merchant_name or txn.name,
                        original_description=txn.name,
                        plaid_category=category_str,
                        is_pending=txn.pending,
                        is_income=is_income,
                    )
                    
                    if txn.location:
                        transaction.merchant_city = txn.location.city
                        transaction.merchant_state = txn.location.region
                        transaction.merchant_zip = txn.location.postal_code
                    
                    self.db.add(transaction)
                    added_count += 1
                
                cursor = response.next_cursor
                has_more = response.has_more
            
            account.plaid_cursor = cursor
            account.last_sync_at = datetime.utcnow()
            account.transactions_synced_count = (account.transactions_synced_count or 0) + added_count
            
            await self.db.commit()
            
            return {"added": added_count, "cursor": cursor}
            
        except ApiException as e:
            logger.error(f"Plaid sync error: {e}")
            raise Exception(f"Plaid error: {e.body}")
    
    async def create_sandbox_token(self, institution_id: str = "ins_109508") -> str:
        """Create a sandbox public token for testing."""
        try:
            request = SandboxPublicTokenCreateRequest(
                institution_id=institution_id,
                initial_products=[Products("transactions")],
            )
            response = self.client.sandbox_public_token_create(request)
            return response.public_token
        except ApiException as e:
            logger.error(f"Plaid sandbox error: {e}")
            raise Exception(f"Plaid error: {e.body}")
