from datetime import datetime, date
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel, EmailStr

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.income_source import Client
from app.models.invoice import Invoice, InvoiceStatus
from app.models.transaction import Transaction

router = APIRouter()


class ClientCreate(BaseModel):
    name: str
    company_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "US"
    notes: Optional[str] = None
    payment_terms: Optional[str] = "net_30"
    hourly_rate: Optional[float] = None
    default_currency: str = "USD"
    tags: Optional[List[str]] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    hourly_rate: Optional[float] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None


@router.get("", response_model=dict)
async def get_clients(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> Any:
    """Get all clients."""
    
    query = db.query(Client).filter(
        Client.user_id == current_user.id,
        Client.is_deleted == False,
    )
    
    if status:
        query = query.filter(Client.status == status)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.company_name.ilike(search_term)) |
            (Client.email.ilike(search_term))
        )
    
    total = query.count()
    clients = query.order_by(Client.name).offset(skip).limit(limit).all()
    
    result = []
    for client in clients:
        invoices = db.query(Invoice).filter(
            Invoice.client_id == client.id,
            Invoice.is_deleted == False,
        ).all()
        
        total_invoiced = sum(i.total_amount for i in invoices)
        total_paid = sum(i.amount_paid for i in invoices)
        outstanding = sum(i.amount_due for i in invoices if i.status != InvoiceStatus.PAID)
        
        result.append({
            "id": str(client.id),
            "name": client.name,
            "company_name": client.company_name,
            "email": client.email,
            "phone": client.phone,
            "status": client.status,
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "outstanding": outstanding,
            "invoice_count": len(invoices),
            "last_invoice_date": max([i.issue_date for i in invoices], default=None),
        })
    
    return {
        "clients": result,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/{client_id}", response_model=dict)
async def get_client(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get client details."""
    
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.user_id == current_user.id,
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    invoices = db.query(Invoice).filter(
        Invoice.client_id == client_id,
        Invoice.is_deleted == False,
    ).order_by(desc(Invoice.issue_date)).limit(20).all()
    
    income_txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == True,
        Transaction.merchant_name.ilike(f"%{client.name}%"),
    ).order_by(desc(Transaction.transaction_date)).limit(20).all()
    
    total_revenue = sum(i.amount_paid for i in invoices)
    
    return {
        "client": {
            "id": str(client.id),
            "name": client.name,
            "company_name": client.company_name,
            "email": client.email,
            "phone": client.phone,
            "website": client.website,
            "address": client.full_address,
            "notes": client.notes,
            "payment_terms": client.payment_terms,
            "hourly_rate": client.hourly_rate,
            "status": client.status,
            "tags": client.tags,
            "created_at": client.created_at.isoformat(),
        },
        "statistics": {
            "total_revenue": total_revenue,
            "total_invoiced": sum(i.total_amount for i in invoices),
            "outstanding": sum(i.amount_due for i in invoices if i.status != InvoiceStatus.PAID),
            "invoice_count": len(invoices),
            "avg_invoice_amount": total_revenue / len(invoices) if invoices else 0,
            "avg_days_to_pay": client.average_days_to_pay,
        },
        "recent_invoices": [
            {
                "id": str(i.id),
                "number": i.invoice_number,
                "amount": i.total_amount,
                "status": i.status.value,
                "date": str(i.issue_date),
            }
            for i in invoices[:5]
        ],
        "recent_payments": [
            {
                "id": str(t.id),
                "amount": abs(t.amount),
                "date": str(t.transaction_date),
            }
            for t in income_txns[:5]
        ],
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new client."""
    
    client = Client(
        user_id=current_user.id,
        name=client_data.name,
        company_name=client_data.company_name,
        email=client_data.email,
        phone=client_data.phone,
        website=client_data.website,
        address=client_data.address,
        city=client_data.city,
        state=client_data.state,
        zip_code=client_data.zip_code,
        country=client_data.country,
        notes=client_data.notes,
        payment_terms=client_data.payment_terms,
        hourly_rate=client_data.hourly_rate,
        default_currency=client_data.default_currency,
        tags=client_data.tags or [],
    )
    
    db.add(client)
    db.commit()
    db.refresh(client)
    
    return {
        "id": str(client.id),
        "name": client.name,
        "message": "Client created successfully",
    }


@router.put("/{client_id}", response_model=dict)
async def update_client(
    client_id: UUID,
    client_data: ClientUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update a client."""
    
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.user_id == current_user.id,
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    update_data = client_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)
    
    db.commit()
    db.refresh(client)
    
    return {
        "id": str(client.id),
        "name": client.name,
        "message": "Client updated successfully",
    }


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a client."""
    
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.user_id == current_user.id,
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    client.soft_delete()
    db.commit()


@router.get("/{client_id}/invoices", response_model=dict)
async def get_client_invoices(
    client_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> Any:
    """Get all invoices for a client."""
    
    client = db.query(Client).filter(
        Client.id == client_id,
        Client.user_id == current_user.id,
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found",
        )
    
    query = db.query(Invoice).filter(
        Invoice.client_id == client_id,
        Invoice.is_deleted == False,
    )
    
    total = query.count()
    invoices = query.order_by(desc(Invoice.issue_date)).offset(skip).limit(limit).all()
    
    return {
        "client": {"id": str(client.id), "name": client.name},
        "invoices": [i.to_summary_dict() for i in invoices],
        "total": total,
    }
