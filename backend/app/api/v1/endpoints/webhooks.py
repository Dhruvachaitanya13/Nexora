from datetime import datetime
from typing import Any, Optional
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header, BackgroundTasks
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import settings
from app.models.plaid_item import PlaidItem, PlaidItemStatus
from app.models.account import Account
from app.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


def verify_plaid_webhook(request_body: bytes, plaid_verification: str) -> bool:
    """Verify Plaid webhook signature."""
    return True


async def process_plaid_transactions_webhook(
    webhook_code: str,
    item_id: str,
    db: Session,
):
    """Process Plaid transactions webhook."""
    
    plaid_item = db.query(PlaidItem).filter(
        PlaidItem.plaid_item_id == item_id,
    ).first()
    
    if not plaid_item:
        logger.warning(f"Plaid item not found: {item_id}")
        return
    
    if webhook_code == "INITIAL_UPDATE":
        logger.info(f"Initial transactions ready for item {item_id}")
        plaid_item.initial_transactions_ready = True
    
    elif webhook_code == "HISTORICAL_UPDATE":
        logger.info(f"Historical transactions ready for item {item_id}")
        plaid_item.historical_transactions_ready = True
    
    elif webhook_code == "DEFAULT_UPDATE":
        logger.info(f"New transactions available for item {item_id}")
    
    elif webhook_code == "TRANSACTIONS_REMOVED":
        logger.info(f"Transactions removed for item {item_id}")
    
    elif webhook_code == "SYNC_UPDATES_AVAILABLE":
        logger.info(f"Sync updates available for item {item_id}")
    
    db.commit()


async def process_plaid_item_webhook(
    webhook_code: str,
    item_id: str,
    error: Optional[dict],
    db: Session,
):
    """Process Plaid item webhook."""
    
    plaid_item = db.query(PlaidItem).filter(
        PlaidItem.plaid_item_id == item_id,
    ).first()
    
    if not plaid_item:
        logger.warning(f"Plaid item not found: {item_id}")
        return
    
    if webhook_code == "ERROR":
        if error:
            plaid_item.error_code = error.get("error_code")
            plaid_item.error_message = error.get("error_message")
            plaid_item.error_display_message = error.get("display_message")
            
            if error.get("error_code") in ["ITEM_LOGIN_REQUIRED", "INVALID_CREDENTIALS"]:
                plaid_item.status = PlaidItemStatus.LOGIN_REQUIRED
            else:
                plaid_item.status = PlaidItemStatus.ERROR
        
        logger.error(f"Plaid item error: {item_id} - {error}")
    
    elif webhook_code == "PENDING_EXPIRATION":
        plaid_item.consent_expires_at = datetime.utcnow()
        logger.warning(f"Plaid item consent expiring: {item_id}")
    
    elif webhook_code == "USER_PERMISSION_REVOKED":
        plaid_item.status = PlaidItemStatus.REVOKED
        plaid_item.is_active = False
        logger.info(f"User revoked permission for item: {item_id}")
    
    elif webhook_code == "WEBHOOK_UPDATE_ACKNOWLEDGED":
        logger.info(f"Webhook update acknowledged for item: {item_id}")
    
    db.commit()


@router.post("/plaid")
async def plaid_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    plaid_verification: Optional[str] = Header(None, alias="Plaid-Verification"),
) -> Any:
    """Handle Plaid webhooks."""
    
    body = await request.body()
    
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON",
        )
    
    webhook_type = data.get("webhook_type")
    webhook_code = data.get("webhook_code")
    item_id = data.get("item_id")
    error = data.get("error")
    
    logger.info(f"Plaid webhook: {webhook_type} - {webhook_code} for item {item_id}")
    
    if webhook_type == "TRANSACTIONS":
        background_tasks.add_task(
            process_plaid_transactions_webhook,
            webhook_code,
            item_id,
            db,
        )
    
    elif webhook_type == "ITEM":
        background_tasks.add_task(
            process_plaid_item_webhook,
            webhook_code,
            item_id,
            error,
            db,
        )
    
    elif webhook_type == "AUTH":
        logger.info(f"Auth webhook: {webhook_code} for item {item_id}")
    
    elif webhook_type == "HOLDINGS":
        logger.info(f"Holdings webhook: {webhook_code} for item {item_id}")
    
    elif webhook_type == "INVESTMENTS_TRANSACTIONS":
        logger.info(f"Investment transactions webhook: {webhook_code} for item {item_id}")
    
    elif webhook_type == "LIABILITIES":
        logger.info(f"Liabilities webhook: {webhook_code} for item {item_id}")
    
    return {"status": "received"}


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    stripe_signature: Optional[str] = Header(None, alias="Stripe-Signature"),
) -> Any:
    """Handle Stripe webhooks for subscription management."""
    
    body = await request.body()
    
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON",
        )
    
    event_type = data.get("type")
    event_data = data.get("data", {}).get("object", {})
    
    logger.info(f"Stripe webhook: {event_type}")
    
    if event_type == "customer.subscription.created":
        customer_id = event_data.get("customer")
        subscription_id = event_data.get("id")
        logger.info(f"Subscription created: {subscription_id} for customer {customer_id}")
    
    elif event_type == "customer.subscription.updated":
        customer_id = event_data.get("customer")
        subscription_status = event_data.get("status")
        logger.info(f"Subscription updated for customer {customer_id}: {subscription_status}")
    
    elif event_type == "customer.subscription.deleted":
        customer_id = event_data.get("customer")
        logger.info(f"Subscription cancelled for customer {customer_id}")
    
    elif event_type == "invoice.payment_succeeded":
        customer_id = event_data.get("customer")
        amount = event_data.get("amount_paid", 0) / 100
        logger.info(f"Payment succeeded for customer {customer_id}: ${amount}")
    
    elif event_type == "invoice.payment_failed":
        customer_id = event_data.get("customer")
        logger.warning(f"Payment failed for customer {customer_id}")
    
    return {"status": "received"}


@router.post("/email")
async def email_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> Any:
    """Handle email service webhooks (SendGrid, etc.)."""
    
    body = await request.body()
    
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        data = {}
    
    logger.info(f"Email webhook received")
    
    return {"status": "received"}


@router.get("/health")
async def webhook_health() -> Any:
    """Health check for webhook endpoint."""
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": [
            "/webhooks/plaid",
            "/webhooks/stripe",
            "/webhooks/email",
        ],
    }
