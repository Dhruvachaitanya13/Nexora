from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc
from pydantic import BaseModel, Field

from app.api.deps import (
    get_db, get_current_user, get_ai_engine, get_financial_context,
    check_feature_access
)
from app.models.user import User
from app.models.transaction import Transaction, TransactionStatus, ScheduleCCategory
from app.models.account import Account
from app.services.ai.engine import AIEngine
from app.services.ai.categorization import SmartCategorizer, ReceiptOCR
from app.services.ai.context import FinancialContext

router = APIRouter()


class TransactionCreate(BaseModel):
    account_id: Optional[UUID] = None
    amount: float
    transaction_date: date
    merchant_name: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_business_expense: bool = False
    is_tax_deductible: bool = False
    business_percentage: float = Field(100.0, ge=0, le=100)
    schedule_c_category: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class TransactionUpdate(BaseModel):
    merchant_name: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    user_category: Optional[str] = None
    user_subcategory: Optional[str] = None
    is_business_expense: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    business_percentage: Optional[float] = Field(None, ge=0, le=100)
    schedule_c_category: Optional[str] = None
    is_recurring: Optional[bool] = None
    is_hidden: Optional[bool] = None
    is_excluded_from_reports: Optional[bool] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class TransactionCategorize(BaseModel):
    category: str
    subcategory: Optional[str] = None
    is_business_expense: bool = False
    is_tax_deductible: Optional[bool] = None
    business_percentage: float = Field(100.0, ge=0, le=100)
    schedule_c_category: Optional[str] = None
    apply_to_similar: bool = False


class BulkCategorize(BaseModel):
    transaction_ids: List[UUID]
    category: str
    is_business_expense: bool = False
    schedule_c_category: Optional[str] = None


class TransactionFilter(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    category: Optional[str] = None
    merchant: Optional[str] = None
    is_income: Optional[bool] = None
    is_expense: Optional[bool] = None
    is_business_expense: Optional[bool] = None
    is_tax_deductible: Optional[bool] = None
    is_recurring: Optional[bool] = None
    is_uncategorized: Optional[bool] = None
    account_id: Optional[UUID] = None
    search: Optional[str] = None


class TransactionResponse(BaseModel):
    id: str
    account_id: Optional[str]
    transaction_date: date
    amount: float
    merchant_name: Optional[str]
    name: Optional[str]
    category: str
    is_income: bool
    is_business_expense: bool
    is_tax_deductible: bool
    schedule_c_category: Optional[str]
    
    class Config:
        from_attributes = True


@router.get("", response_model=dict)
async def get_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    merchant: Optional[str] = None,
    is_income: Optional[bool] = None,
    is_business: Optional[bool] = None,
    is_uncategorized: Optional[bool] = None,
    account_id: Optional[UUID] = None,
    search: Optional[str] = None,
    sort_by: str = Query("transaction_date", regex="^(transaction_date|amount|merchant_name|created_at)$"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
) -> Any:
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_deleted == 'N',
        Transaction.is_hidden == False,
    )
    
    if start_date:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date:
        query = query.filter(Transaction.transaction_date <= end_date)
    if category:
        query = query.filter(Transaction.user_category == category)
    if merchant:
        query = query.filter(Transaction.merchant_name.ilike(f"%{merchant}%"))
    if is_income is not None:
        query = query.filter(Transaction.is_income == is_income)
    if is_business is not None:
        query = query.filter(Transaction.is_business_expense == is_business)
    if is_uncategorized:
        query = query.filter(Transaction.user_category == None)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Transaction.merchant_name.ilike(search_term),
                Transaction.name.ilike(search_term),
                Transaction.description.ilike(search_term),
            )
        )
    
    total = query.count()
    
    sort_column = getattr(Transaction, sort_by)
    if sort_order == "desc":
        sort_column = desc(sort_column)
    query = query.order_by(sort_column)
    
    transactions = query.offset(skip).limit(limit).all()
    
    return {
        "transactions": [t.to_summary_dict() for t in transactions],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + limit < total,
    }


@router.get("/summary", response_model=dict)
async def get_transactions_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == 'N',
    )
    
    transactions = query.all()
    
    total_income = sum(abs(t.amount) for t in transactions if t.is_income)
    total_expenses = sum(abs(t.amount) for t in transactions if not t.is_income and not t.is_transfer)
    total_business = sum(abs(t.amount) for t in transactions if t.is_business_expense)
    total_deductible = sum(t.tax_deduction_amount for t in transactions if t.is_tax_deductible)
    
    by_category = {}
    for t in transactions:
        if not t.is_income and not t.is_transfer:
            cat = t.category_display
            by_category[cat] = by_category.get(cat, 0) + abs(t.amount)
    
    uncategorized = [t for t in transactions if not t.is_categorized and not t.is_income]
    
    return {
        "period": {"start": str(start_date), "end": str(end_date)},
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "total_business_expenses": total_business,
        "total_tax_deductible": total_deductible,
        "transaction_count": len(transactions),
        "by_category": dict(sorted(by_category.items(), key=lambda x: -x[1])[:10]),
        "uncategorized_count": len(uncategorized),
        "uncategorized_amount": sum(abs(t.amount) for t in uncategorized),
    }


@router.get("/uncategorized", response_model=dict)
async def get_uncategorized_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> Any:
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.user_category == None,
        Transaction.is_income == False,
        Transaction.is_transfer == False,
        Transaction.is_deleted == 'N',
    ).order_by(desc(Transaction.transaction_date)).limit(limit).all()
    
    return {
        "transactions": [t.to_full_dict() for t in transactions],
        "count": len(transactions),
    }


@router.get("/{transaction_id}", response_model=dict)
async def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    return transaction.to_full_dict()


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    if transaction_data.account_id:
        account = db.query(Account).filter(
            Account.id == transaction_data.account_id,
            Account.user_id == current_user.id,
        ).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )
    
    schedule_c = None
    if transaction_data.schedule_c_category:
        try:
            schedule_c = ScheduleCCategory(transaction_data.schedule_c_category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Schedule C category",
            )
    
    transaction = Transaction(
        user_id=current_user.id,
        account_id=transaction_data.account_id,
        amount=transaction_data.amount,
        transaction_date=transaction_data.transaction_date,
        merchant_name=transaction_data.merchant_name,
        name=transaction_data.name or transaction_data.merchant_name,
        description=transaction_data.description,
        user_category=transaction_data.category,
        is_business_expense=transaction_data.is_business_expense,
        is_tax_deductible=transaction_data.is_tax_deductible or transaction_data.is_business_expense,
        business_percentage=transaction_data.business_percentage,
        schedule_c_category=schedule_c,
        notes=transaction_data.notes,
        tags=transaction_data.tags or [],
        is_manual=True,
        import_source="manual",
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction.to_full_dict()


@router.put("/{transaction_id}", response_model=dict)
async def update_transaction(
    transaction_id: UUID,
    transaction_data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    update_data = transaction_data.dict(exclude_unset=True)
    
    if "schedule_c_category" in update_data and update_data["schedule_c_category"]:
        try:
            update_data["schedule_c_category"] = ScheduleCCategory(update_data["schedule_c_category"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Schedule C category",
            )
    
    for field, value in update_data.items():
        setattr(transaction, field, value)
    
    if transaction.is_business_expense and not transaction.is_tax_deductible:
        transaction.is_tax_deductible = True
    
    transaction.is_reviewed = True
    transaction.reviewed_at = datetime.utcnow()
    transaction.reviewed_by = current_user.id
    
    db.commit()
    db.refresh(transaction)
    
    return transaction.to_full_dict()


@router.post("/{transaction_id}/categorize", response_model=dict)
async def categorize_transaction(
    transaction_id: UUID,
    categorize_data: TransactionCategorize,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
) -> Any:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    schedule_c = None
    if categorize_data.schedule_c_category:
        try:
            schedule_c = ScheduleCCategory(categorize_data.schedule_c_category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Schedule C category",
            )
    
    transaction.user_category = categorize_data.category
    transaction.user_subcategory = categorize_data.subcategory
    transaction.is_business_expense = categorize_data.is_business_expense
    transaction.is_tax_deductible = categorize_data.is_tax_deductible if categorize_data.is_tax_deductible is not None else categorize_data.is_business_expense
    transaction.business_percentage = categorize_data.business_percentage
    transaction.schedule_c_category = schedule_c
    transaction.is_reviewed = True
    transaction.reviewed_at = datetime.utcnow()
    
    db.commit()
    
    if categorize_data.apply_to_similar:
        categorizer = SmartCategorizer(engine, db)
        await categorizer.learn_from_user_correction(
            str(transaction_id),
            str(current_user.id),
            categorize_data.category,
            categorize_data.is_business_expense,
            categorize_data.schedule_c_category,
        )
    
    db.refresh(transaction)
    return transaction.to_full_dict()


@router.post("/categorize/bulk", response_model=dict)
async def bulk_categorize_transactions(
    bulk_data: BulkCategorize,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    schedule_c = None
    if bulk_data.schedule_c_category:
        try:
            schedule_c = ScheduleCCategory(bulk_data.schedule_c_category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid Schedule C category",
            )
    
    updated_count = db.query(Transaction).filter(
        Transaction.id.in_(bulk_data.transaction_ids),
        Transaction.user_id == current_user.id,
    ).update({
        Transaction.user_category: bulk_data.category,
        Transaction.is_business_expense: bulk_data.is_business_expense,
        Transaction.is_tax_deductible: bulk_data.is_business_expense,
        Transaction.schedule_c_category: schedule_c,
        Transaction.is_reviewed: True,
        Transaction.reviewed_at: datetime.utcnow(),
    }, synchronize_session=False)
    
    db.commit()
    
    return {
        "updated_count": updated_count,
        "message": f"Successfully categorized {updated_count} transactions",
    }


@router.post("/{transaction_id}/ai-categorize", response_model=dict)
async def ai_categorize_transaction(
    transaction_id: UUID,
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    categorizer = SmartCategorizer(engine, db)
    result = await categorizer.categorize(transaction.to_full_dict(), context)
    
    return {
        "transaction_id": str(transaction_id),
        "suggestion": result.to_dict(),
    }


@router.post("/ai-categorize/bulk", response_model=dict)
async def ai_categorize_bulk(
    transaction_ids: List[UUID],
    current_user: User = Depends(check_feature_access("ai_chat")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    transactions = db.query(Transaction).filter(
        Transaction.id.in_(transaction_ids),
        Transaction.user_id == current_user.id,
    ).all()
    
    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No transactions found",
        )
    
    categorizer = SmartCategorizer(engine, db)
    results = await categorizer.categorize_batch(
        [t.to_full_dict() for t in transactions],
        context,
    )
    
    return {
        "results": [
            {
                "transaction_id": str(transactions[i].id),
                "suggestion": results[i].to_dict(),
            }
            for i in range(len(results))
        ]
    }


@router.post("/{transaction_id}/receipt", response_model=dict)
async def upload_receipt(
    transaction_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
) -> Any:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
    
    import base64
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode()
    
    ocr = ReceiptOCR(engine)
    receipt_data = await ocr.process_receipt(image_base64)
    
    transaction.receipt_ocr_data = receipt_data
    transaction.receipt_uploaded_at = datetime.utcnow()
    
    db.commit()
    db.refresh(transaction)
    
    return {
        "transaction_id": str(transaction_id),
        "receipt_data": receipt_data,
        "message": "Receipt processed successfully",
    }


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    
    if transaction.plaid_transaction_id:
        transaction.is_hidden = True
    else:
        transaction.soft_delete()
    
    db.commit()
