from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.account import Account, AccountType, AccountSubtype, AccountSyncStatus
from app.models.plaid_item import PlaidItem, PlaidItemStatus
from app.models.transaction import Transaction
from app.core.config import settings

import plaid
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products

router = APIRouter()


def get_plaid_client():
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox if settings.plaid.PLAID_ENV == "sandbox" else plaid.Environment.Production,
        api_key={
            'clientId': settings.plaid.PLAID_CLIENT_ID,
            'secret': settings.plaid.PLAID_SECRET,
        }
    )
    api_client = plaid.ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


class LinkTokenResponse(BaseModel):
    link_token: str
    expiration: str


class PublicTokenExchange(BaseModel):
    public_token: str
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None


class ItemResponse(BaseModel):
    item_id: str
    institution_name: str
    accounts: List[dict]


@router.post("/link/token", response_model=LinkTokenResponse)
async def create_link_token(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Create a Plaid Link token for connecting a bank account."""
    
    client = get_plaid_client()
    
    request = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(
            client_user_id=str(current_user.id),
        ),
        client_name="Nexora",
        products=[Products("transactions")],
        country_codes=[CountryCode("US")],
        language="en",
        webhook=f"{settings.API_BASE_URL}/api/v1/webhooks/plaid",
    )
    
    try:
        response = client.link_token_create(request)
        return LinkTokenResponse(
            link_token=response.link_token,
            expiration=response.expiration.isoformat(),
        )
    except plaid.ApiException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plaid error: {e.body}",
        )


@router.post("/link/token/update/{item_id}", response_model=LinkTokenResponse)
async def create_update_link_token(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a Link token for updating an existing connection."""
    
    plaid_item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.user_id == current_user.id,
    ).first()
    
    if not plaid_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )
    
    client = get_plaid_client()
    
    request = LinkTokenCreateRequest(
        user=LinkTokenCreateRequestUser(
            client_user_id=str(current_user.id),
        ),
        client_name="Nexora",
        country_codes=[CountryCode("US")],
        language="en",
        access_token=plaid_item.plaid_access_token,
    )
    
    try:
        response = client.link_token_create(request)
        return LinkTokenResponse(
            link_token=response.link_token,
            expiration=response.expiration.isoformat(),
        )
    except plaid.ApiException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plaid error: {e.body}",
        )


@router.post("/exchange", response_model=dict)
async def exchange_public_token(
    exchange_data: PublicTokenExchange,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Exchange public token for access token and create accounts."""
    
    client = get_plaid_client()
    
    try:
        exchange_request = ItemPublicTokenExchangeRequest(
            public_token=exchange_data.public_token,
        )
        exchange_response = client.item_public_token_exchange(exchange_request)
        
        access_token = exchange_response.access_token
        plaid_item_id = exchange_response.item_id
        
        item_request = ItemGetRequest(access_token=access_token)
        item_response = client.item_get(item_request)
        
        institution_name = exchange_data.institution_name or "Unknown Institution"
        institution_id = exchange_data.institution_id or item_response.item.institution_id
        
        if institution_id:
            try:
                inst_request = InstitutionsGetByIdRequest(
                    institution_id=institution_id,
                    country_codes=[CountryCode("US")],
                )
                inst_response = client.institutions_get_by_id(inst_request)
                institution_name = inst_response.institution.name
            except:
                pass
        
        plaid_item = PlaidItem(
            user_id=current_user.id,
            plaid_item_id=plaid_item_id,
            plaid_access_token=access_token,
            institution_id=institution_id,
            institution_name=institution_name,
            status=PlaidItemStatus.ACTIVE,
            available_products=["transactions"],
        )
        
        db.add(plaid_item)
        db.flush()
        
        accounts_request = AccountsGetRequest(access_token=access_token)
        accounts_response = client.accounts_get(accounts_request)
        
        created_accounts = []
        for plaid_account in accounts_response.accounts:
            account_type = AccountType.DEPOSITORY
            if plaid_account.type:
                type_mapping = {
                    "depository": AccountType.DEPOSITORY,
                    "credit": AccountType.CREDIT,
                    "loan": AccountType.LOAN,
                    "investment": AccountType.INVESTMENT,
                    "brokerage": AccountType.BROKERAGE,
                }
                account_type = type_mapping.get(plaid_account.type.value, AccountType.DEPOSITORY)
            
            account_subtype = None
            if plaid_account.subtype:
                try:
                    account_subtype = AccountSubtype(plaid_account.subtype.value)
                except ValueError:
                    pass
            
            account = Account(
                user_id=current_user.id,
                plaid_item_id=plaid_item.id,
                plaid_account_id=plaid_account.account_id,
                account_name=plaid_account.name,
                official_name=plaid_account.official_name,
                mask=plaid_account.mask,
                account_type=account_type,
                account_subtype=account_subtype,
                current_balance=plaid_account.balances.current,
                available_balance=plaid_account.balances.available,
                credit_limit=plaid_account.balances.limit,
                currency=plaid_account.balances.iso_currency_code or "USD",
                institution_name=institution_name,
                sync_status=AccountSyncStatus.SYNCED,
                last_synced_at=datetime.utcnow(),
            )
            
            db.add(account)
            created_accounts.append({
                "name": account.account_name,
                "type": account_type.value,
                "balance": account.current_balance,
                "mask": account.mask,
            })
        
        db.commit()
        
        background_tasks.add_task(sync_transactions_task, str(plaid_item.id), db)
        
        return {
            "success": True,
            "item_id": str(plaid_item.id),
            "institution": institution_name,
            "accounts": created_accounts,
            "message": f"Successfully connected {len(created_accounts)} accounts from {institution_name}",
        }
        
    except plaid.ApiException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plaid error: {e.body}",
        )


async def sync_transactions_task(plaid_item_id: str, db: Session):
    """Background task to sync transactions."""
    pass


@router.get("/items", response_model=dict)
async def get_plaid_items(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get all connected Plaid items (institutions)."""
    
    items = db.query(PlaidItem).filter(
        PlaidItem.user_id == current_user.id,
        PlaidItem.status != PlaidItemStatus.REVOKED,
    ).all()
    
    result = []
    for item in items:
        accounts = db.query(Account).filter(
            Account.plaid_item_id == item.id,
            Account.is_active == True,
        ).all()
        
        result.append({
            "id": str(item.id),
            "institution_name": item.institution_name,
            "institution_id": item.institution_id,
            "status": item.status.value,
            "is_healthy": item.is_healthy,
            "needs_reauth": item.needs_reauth,
            "last_synced": item.last_successful_update.isoformat() if item.last_successful_update else None,
            "accounts_count": len(accounts),
            "error": item.error_display_message if item.error_code else None,
        })
    
    return {"items": result}


@router.get("/items/{item_id}", response_model=dict)
async def get_plaid_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get Plaid item details."""
    
    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.user_id == current_user.id,
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )
    
    accounts = db.query(Account).filter(
        Account.plaid_item_id == item.id,
    ).all()
    
    return {
        "item": item.to_full_dict(),
        "accounts": [a.to_summary_dict() for a in accounts],
    }


@router.post("/items/{item_id}/sync", response_model=dict)
async def sync_plaid_item(
    item_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Manually trigger sync for a Plaid item."""
    
    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.user_id == current_user.id,
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )
    
    if not item.is_healthy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item requires reauthorization before syncing",
        )
    
    client = get_plaid_client()
    
    try:
        sync_request = TransactionsSyncRequest(
            access_token=item.plaid_access_token,
            cursor=item.transactions_cursor,
        )
        sync_response = client.transactions_sync(sync_request)
        
        added_count = 0
        modified_count = 0
        removed_count = 0
        
        for txn in sync_response.added:
            account = db.query(Account).filter(
                Account.plaid_account_id == txn.account_id,
                Account.user_id == current_user.id,
            ).first()
            
            if account:
                existing = db.query(Transaction).filter(
                    Transaction.plaid_transaction_id == txn.transaction_id,
                ).first()
                
                if not existing:
                    transaction = Transaction(
                        user_id=current_user.id,
                        account_id=account.id,
                        plaid_transaction_id=txn.transaction_id,
                        amount=txn.amount * -1,
                        transaction_date=txn.date,
                        authorized_date=txn.authorized_date,
                        merchant_name=txn.merchant_name,
                        name=txn.name,
                        description=txn.original_description,
                        plaid_category=txn.personal_finance_category.primary if txn.personal_finance_category else None,
                        pending=txn.pending,
                        payment_channel=txn.payment_channel.value if txn.payment_channel else None,
                    )
                    db.add(transaction)
                    added_count += 1
        
        for txn in sync_response.modified:
            existing = db.query(Transaction).filter(
                Transaction.plaid_transaction_id == txn.transaction_id,
            ).first()
            
            if existing:
                existing.amount = txn.amount * -1
                existing.merchant_name = txn.merchant_name
                existing.pending = txn.pending
                modified_count += 1
        
        for removed_txn in sync_response.removed:
            existing = db.query(Transaction).filter(
                Transaction.plaid_transaction_id == removed_txn.transaction_id,
            ).first()
            
            if existing:
                existing.is_deleted = True
                removed_count += 1
        
        item.transactions_cursor = sync_response.next_cursor
        item.mark_sync_success()
        
        db.commit()
        
        return {
            "success": True,
            "added": added_count,
            "modified": modified_count,
            "removed": removed_count,
            "has_more": sync_response.has_more,
        }
        
    except plaid.ApiException as e:
        item.mark_sync_failure(str(e))
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sync failed: {e.body}",
        )


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_plaid_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Remove a Plaid connection."""
    
    item = db.query(PlaidItem).filter(
        PlaidItem.id == item_id,
        PlaidItem.user_id == current_user.id,
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plaid item not found",
        )
    
    db.query(Account).filter(Account.plaid_item_id == item.id).update({
        "is_active": False,
        "plaid_item_id": None,
    })
    
    item.status = PlaidItemStatus.REVOKED
    item.is_active = False
    
    db.commit()


@router.get("/sync/status", response_model=dict)
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get sync status for all connected accounts."""
    
    items = db.query(PlaidItem).filter(
        PlaidItem.user_id == current_user.id,
        PlaidItem.status == PlaidItemStatus.ACTIVE,
    ).all()
    
    accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.is_active == True,
        Account.plaid_item_id != None,
    ).all()
    
    needs_attention = [i for i in items if not i.is_healthy]
    
    return {
        "total_items": len(items),
        "healthy_items": len([i for i in items if i.is_healthy]),
        "needs_reauth": len([i for i in items if i.needs_reauth]),
        "total_accounts": len(accounts),
        "last_sync": max([i.last_successful_update for i in items if i.last_successful_update], default=None),
        "items_needing_attention": [
            {
                "id": str(i.id),
                "institution": i.institution_name,
                "status": i.status.value,
                "error": i.error_display_message,
            }
            for i in needs_attention
        ],
    }
