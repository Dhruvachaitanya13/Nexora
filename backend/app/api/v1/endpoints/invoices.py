from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID
import secrets

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from pydantic import BaseModel, Field, EmailStr

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.invoice import Invoice, InvoiceStatus, InvoiceItem, InvoicePayment, PaymentTerm, PaymentMethod
from app.models.income_source import Client

router = APIRouter()


class InvoiceItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    quantity: float = 1.0
    unit_price: float
    discount_percentage: float = 0.0
    tax_rate: float = 0.0


class InvoiceCreate(BaseModel):
    client_id: Optional[UUID] = None
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    client_company: Optional[str] = None
    client_address: Optional[str] = None
    
    invoice_number_prefix: Optional[str] = "INV"
    
    issue_date: date = Field(default_factory=date.today)
    payment_terms: str = "net_30"
    custom_payment_days: Optional[int] = None
    
    items: List[InvoiceItemCreate]
    
    discount_type: Optional[str] = None
    discount_value: float = 0.0
    tax_rate: float = 0.0
    shipping_amount: float = 0.0
    
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    
    is_recurring: bool = False
    recurring_frequency: Optional[str] = None


class InvoiceUpdate(BaseModel):
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    status: Optional[str] = None


class PaymentRecord(BaseModel):
    amount: float
    payment_date: date = Field(default_factory=date.today)
    payment_method: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class InvoiceSend(BaseModel):
    recipient_email: Optional[EmailStr] = None
    subject: Optional[str] = None
    message: Optional[str] = None


@router.get("", response_model=dict)
async def get_invoices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    client_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = Query("issue_date", regex="^(issue_date|due_date|total_amount|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
) -> Any:
    """Get all invoices with filtering."""
    
    query = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.is_deleted == False,
    )
    
    if status:
        try:
            status_enum = InvoiceStatus(status)
            query = query.filter(Invoice.status == status_enum)
        except ValueError:
            pass
    
    if client_id:
        query = query.filter(Invoice.client_id == client_id)
    
    if start_date:
        query = query.filter(Invoice.issue_date >= start_date)
    if end_date:
        query = query.filter(Invoice.issue_date <= end_date)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Invoice.invoice_number.ilike(search_term),
                Invoice.client_name.ilike(search_term),
                Invoice.client_company.ilike(search_term),
            )
        )
    
    total = query.count()
    
    sort_column = getattr(Invoice, sort_by)
    if sort_order == "desc":
        sort_column = desc(sort_column)
    query = query.order_by(sort_column)
    
    invoices = query.offset(skip).limit(limit).all()
    
    return {
        "invoices": [i.to_summary_dict() for i in invoices],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/summary", response_model=dict)
async def get_invoices_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get invoice summary statistics."""
    
    invoices = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.is_deleted == False,
    ).all()
    
    draft = [i for i in invoices if i.status == InvoiceStatus.DRAFT]
    sent = [i for i in invoices if i.status in [InvoiceStatus.SENT, InvoiceStatus.VIEWED]]
    overdue = [i for i in invoices if i.is_overdue]
    paid = [i for i in invoices if i.status == InvoiceStatus.PAID]
    
    today = date.today()
    year_start = date(today.year, 1, 1)
    month_start = today.replace(day=1)
    
    ytd_paid = sum(i.total_amount for i in paid if i.paid_at and i.paid_at.date() >= year_start)
    mtd_paid = sum(i.total_amount for i in paid if i.paid_at and i.paid_at.date() >= month_start)
    
    return {
        "total_outstanding": sum(i.amount_due for i in sent),
        "total_overdue": sum(i.amount_due for i in overdue),
        "total_draft": sum(i.total_amount for i in draft),
        "total_paid_ytd": ytd_paid,
        "total_paid_mtd": mtd_paid,
        "counts": {
            "draft": len(draft),
            "sent": len(sent),
            "overdue": len(overdue),
            "paid_ytd": len([i for i in paid if i.paid_at and i.paid_at.date() >= year_start]),
        },
        "aging": {
            "current": sum(i.amount_due for i in sent if not i.is_overdue),
            "1_30_days": sum(i.amount_due for i in overdue if i.days_overdue <= 30),
            "31_60_days": sum(i.amount_due for i in overdue if 30 < i.days_overdue <= 60),
            "61_90_days": sum(i.amount_due for i in overdue if 60 < i.days_overdue <= 90),
            "over_90_days": sum(i.amount_due for i in overdue if i.days_overdue > 90),
        },
    }


@router.get("/{invoice_id}", response_model=dict)
async def get_invoice(
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get invoice details."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice_id).all()
    payments = db.query(InvoicePayment).filter(InvoicePayment.invoice_id == invoice_id).all()
    
    result = invoice.to_full_dict()
    result["items"] = [
        {
            "id": str(item.id),
            "name": item.name,
            "description": item.description,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "discount_percentage": item.discount_percentage,
            "tax_rate": item.tax_rate,
            "total": item.total,
        }
        for item in items
    ]
    result["payments"] = [
        {
            "id": str(p.id),
            "amount": p.amount,
            "payment_date": str(p.payment_date),
            "payment_method": p.payment_method.value if p.payment_method else None,
            "reference_number": p.reference_number,
        }
        for p in payments
    ]
    
    return result


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    invoice_data: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new invoice."""
    
    if not invoice_data.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice must have at least one item",
        )
    
    last_invoice = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.invoice_number_prefix == invoice_data.invoice_number_prefix,
    ).order_by(desc(Invoice.invoice_number_sequence)).first()
    
    sequence = (last_invoice.invoice_number_sequence + 1) if last_invoice else 1
    invoice_number = f"{invoice_data.invoice_number_prefix}-{sequence:05d}"
    
    try:
        payment_terms = PaymentTerm(invoice_data.payment_terms)
    except ValueError:
        payment_terms = PaymentTerm.NET_30
    
    invoice = Invoice(
        user_id=current_user.id,
        client_id=invoice_data.client_id,
        invoice_number=invoice_number,
        invoice_number_prefix=invoice_data.invoice_number_prefix,
        invoice_number_sequence=sequence,
        issue_date=invoice_data.issue_date,
        payment_terms=payment_terms,
        custom_payment_days=invoice_data.custom_payment_days,
        client_name=invoice_data.client_name,
        client_email=invoice_data.client_email,
        client_company=invoice_data.client_company,
        client_address=invoice_data.client_address,
        discount_type=invoice_data.discount_type,
        discount_value=invoice_data.discount_value,
        tax_rate=invoice_data.tax_rate,
        shipping_amount=invoice_data.shipping_amount,
        notes=invoice_data.notes,
        terms_and_conditions=invoice_data.terms_and_conditions,
        is_recurring=invoice_data.is_recurring,
        recurring_frequency=invoice_data.recurring_frequency,
        status=InvoiceStatus.DRAFT,
        from_name=current_user.full_name or current_user.business_name,
        from_email=current_user.email,
        from_company=current_user.business_name,
    )
    
    invoice.calculate_due_date()
    invoice.public_token = secrets.token_urlsafe(32)
    
    db.add(invoice)
    db.flush()
    
    subtotal = 0
    for item_data in invoice_data.items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            name=item_data.name,
            description=item_data.description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            discount_percentage=item_data.discount_percentage,
            tax_rate=item_data.tax_rate,
        )
        item_total = item_data.quantity * item_data.unit_price
        item_total -= item_total * (item_data.discount_percentage / 100)
        item_total += item_total * (item_data.tax_rate / 100)
        item.total = item_total
        subtotal += item_data.quantity * item_data.unit_price
        db.add(item)
    
    invoice.subtotal = subtotal
    invoice.calculate_totals()
    
    db.commit()
    db.refresh(invoice)
    
    return invoice.to_full_dict()


@router.put("/{invoice_id}", response_model=dict)
async def update_invoice(
    invoice_id: UUID,
    invoice_data: InvoiceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update an invoice."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a paid invoice",
        )
    
    update_data = invoice_data.dict(exclude_unset=True)
    
    if "status" in update_data:
        try:
            update_data["status"] = InvoiceStatus(update_data["status"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status",
            )
    
    for field, value in update_data.items():
        setattr(invoice, field, value)
    
    db.commit()
    db.refresh(invoice)
    
    return invoice.to_full_dict()


@router.post("/{invoice_id}/send", response_model=dict)
async def send_invoice(
    invoice_id: UUID,
    send_data: InvoiceSend,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Send invoice to client."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    recipient = send_data.recipient_email or invoice.client_email
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No recipient email provided",
        )
    
    invoice.mark_as_sent()
    db.commit()
    
    return {
        "message": "Invoice sent successfully",
        "invoice_id": str(invoice_id),
        "recipient": recipient,
        "public_url": f"/invoices/view/{invoice.public_token}",
    }


@router.post("/{invoice_id}/payment", response_model=dict)
async def record_payment(
    invoice_id: UUID,
    payment_data: PaymentRecord,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Record a payment for an invoice."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already fully paid",
        )
    
    payment_method = None
    if payment_data.payment_method:
        try:
            payment_method = PaymentMethod(payment_data.payment_method)
        except ValueError:
            pass
    
    payment = InvoicePayment(
        invoice_id=invoice.id,
        amount=payment_data.amount,
        payment_date=payment_data.payment_date,
        payment_method=payment_method,
        reference_number=payment_data.reference_number,
        notes=payment_data.notes,
    )
    
    db.add(payment)
    
    invoice.record_payment(
        amount=payment_data.amount,
        payment_date=payment_data.payment_date,
        payment_method=payment_data.payment_method,
    )
    
    db.commit()
    
    return {
        "message": "Payment recorded successfully",
        "payment_id": str(payment.id),
        "amount_paid": payment_data.amount,
        "remaining_balance": invoice.amount_due,
        "is_paid": invoice.is_paid,
    }


@router.post("/{invoice_id}/remind", response_model=dict)
async def send_reminder(
    invoice_id: UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Send payment reminder for invoice."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice is already paid",
        )
    
    invoice.last_reminder_sent_at = datetime.utcnow()
    db.commit()
    
    return {
        "message": "Reminder sent successfully",
        "invoice_id": str(invoice_id),
    }


@router.post("/{invoice_id}/duplicate", response_model=dict)
async def duplicate_invoice(
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a duplicate of an existing invoice."""
    
    original = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not original:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    last_invoice = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.invoice_number_prefix == original.invoice_number_prefix,
    ).order_by(desc(Invoice.invoice_number_sequence)).first()
    
    sequence = last_invoice.invoice_number_sequence + 1
    
    new_invoice = Invoice(
        user_id=current_user.id,
        client_id=original.client_id,
        invoice_number=f"{original.invoice_number_prefix}-{sequence:05d}",
        invoice_number_prefix=original.invoice_number_prefix,
        invoice_number_sequence=sequence,
        issue_date=date.today(),
        payment_terms=original.payment_terms,
        client_name=original.client_name,
        client_email=original.client_email,
        client_company=original.client_company,
        subtotal=original.subtotal,
        discount_type=original.discount_type,
        discount_value=original.discount_value,
        tax_rate=original.tax_rate,
        total_amount=original.total_amount,
        notes=original.notes,
        terms_and_conditions=original.terms_and_conditions,
        status=InvoiceStatus.DRAFT,
        public_token=secrets.token_urlsafe(32),
    )
    new_invoice.calculate_due_date()
    
    db.add(new_invoice)
    db.flush()
    
    original_items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == original.id).all()
    for item in original_items:
        new_item = InvoiceItem(
            invoice_id=new_invoice.id,
            name=item.name,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_percentage=item.discount_percentage,
            tax_rate=item.tax_rate,
            total=item.total,
        )
        db.add(new_item)
    
    db.commit()
    db.refresh(new_invoice)
    
    return new_invoice.to_full_dict()


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete an invoice."""
    
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found",
        )
    
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a paid invoice",
        )
    
    invoice.soft_delete()
    db.commit()
