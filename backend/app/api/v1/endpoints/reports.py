from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID
import io
import csv

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from app.api.deps import (
    get_db, get_current_user, get_financial_context, get_ai_engine,
    check_feature_access
)
from app.models.user import User
from app.models.transaction import Transaction
from app.models.invoice import Invoice, InvoiceStatus
from app.services.ai.context import FinancialContext
from app.services.ai.engine import AIEngine

router = APIRouter()


class ReportRequest(BaseModel):
    report_type: str
    start_date: date
    end_date: date
    format: str = "json"
    include_details: bool = True


@router.get("/profit-loss", response_model=dict)
async def get_profit_loss_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Generate Profit & Loss report."""
    
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == False,
    ).all()
    
    income_txns = [t for t in transactions if t.is_income]
    expense_txns = [t for t in transactions if not t.is_income and not t.is_transfer]
    
    total_income = sum(abs(t.amount) for t in income_txns)
    
    income_by_source = {}
    for t in income_txns:
        source = t.merchant_name or "Other Income"
        income_by_source[source] = income_by_source.get(source, 0) + abs(t.amount)
    
    total_expenses = sum(abs(t.amount) for t in expense_txns)
    
    expenses_by_category = {}
    for t in expense_txns:
        cat = t.category_display
        expenses_by_category[cat] = expenses_by_category.get(cat, 0) + abs(t.amount)
    
    gross_profit = total_income
    net_profit = total_income - total_expenses
    profit_margin = (net_profit / total_income * 100) if total_income > 0 else 0
    
    return {
        "report_type": "profit_loss",
        "period": {
            "start": str(start_date),
            "end": str(end_date),
        },
        "income": {
            "total": total_income,
            "by_source": dict(sorted(income_by_source.items(), key=lambda x: -x[1])),
        },
        "expenses": {
            "total": total_expenses,
            "by_category": dict(sorted(expenses_by_category.items(), key=lambda x: -x[1])),
        },
        "summary": {
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "profit_margin": profit_margin,
        },
    }


@router.get("/balance-sheet", response_model=dict)
async def get_balance_sheet(
    current_user: User = Depends(get_current_user),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Generate Balance Sheet report."""
    
    assets = {
        "cash": {
            "checking": context.accounts.checking_balance,
            "savings": context.accounts.savings_balance,
            "total": context.accounts.checking_balance + context.accounts.savings_balance,
        },
        "investments": context.accounts.investment_balance,
        "accounts_receivable": context.invoices.total_outstanding,
        "total_assets": context.accounts.total_balance + context.invoices.total_outstanding,
    }
    
    liabilities = {
        "credit_cards": abs(context.accounts.credit_balance),
        "accounts_payable": 0,
        "tax_liability": context.tax.estimated_annual_tax / 4,
        "total_liabilities": abs(context.accounts.credit_balance) + context.tax.estimated_annual_tax / 4,
    }
    
    equity = assets["total_assets"] - liabilities["total_liabilities"]
    
    return {
        "report_type": "balance_sheet",
        "as_of_date": str(date.today()),
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
    }


@router.get("/cash-flow-statement", response_model=dict)
async def get_cash_flow_statement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Generate Cash Flow Statement."""
    
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == False,
    ).all()
    
    operating_income = sum(abs(t.amount) for t in transactions if t.is_income)
    operating_expenses = sum(abs(t.amount) for t in transactions if not t.is_income and not t.is_transfer and t.is_business_expense)
    personal_expenses = sum(abs(t.amount) for t in transactions if not t.is_income and not t.is_transfer and not t.is_business_expense)
    
    net_operating = operating_income - operating_expenses
    
    transfers = [t for t in transactions if t.is_transfer]
    
    return {
        "report_type": "cash_flow_statement",
        "period": {"start": str(start_date), "end": str(end_date)},
        "operating_activities": {
            "income": operating_income,
            "business_expenses": operating_expenses,
            "net_operating_cash_flow": net_operating,
        },
        "personal_activities": {
            "personal_expenses": personal_expenses,
        },
        "net_cash_flow": operating_income - operating_expenses - personal_expenses,
    }


@router.get("/tax-summary", response_model=dict)
async def get_tax_summary_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
    tax_year: Optional[str] = None,
) -> Any:
    """Generate tax summary report for the year."""
    
    if not tax_year:
        tax_year = str(date.today().year)
    
    year_start = date(int(tax_year), 1, 1)
    year_end = date(int(tax_year), 12, 31)
    
    income_txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == True,
        Transaction.transaction_date >= year_start,
        Transaction.transaction_date <= year_end,
    ).all()
    
    expense_txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_business_expense == True,
        Transaction.transaction_date >= year_start,
        Transaction.transaction_date <= year_end,
    ).all()
    
    gross_income = sum(abs(t.amount) for t in income_txns)
    
    deductions_by_category = {}
    for t in expense_txns:
        cat = t.schedule_c_category.value if t.schedule_c_category else "other"
        if cat not in deductions_by_category:
            deductions_by_category[cat] = {"amount": 0, "deductible": 0, "count": 0}
        deductions_by_category[cat]["amount"] += abs(t.amount)
        deductions_by_category[cat]["deductible"] += t.tax_deduction_amount
        deductions_by_category[cat]["count"] += 1
    
    total_deductions = sum(d["deductible"] for d in deductions_by_category.values())
    
    return {
        "report_type": "tax_summary",
        "tax_year": tax_year,
        "income": {
            "gross_receipts": gross_income,
            "projected_annual": context.income.projected_annual,
        },
        "deductions": {
            "total": total_deductions,
            "by_category": deductions_by_category,
        },
        "estimated_tax": {
            "federal": context.tax.federal_tax,
            "state": context.tax.state_tax,
            "self_employment": context.tax.self_employment_tax,
            "total": context.tax.estimated_annual_tax,
            "effective_rate": context.tax.effective_tax_rate,
        },
        "quarterly_estimates": context.tax.quarterly_payment_due,
        "next_deadline": str(context.tax.next_deadline) if context.tax.next_deadline else None,
    }


@router.get("/expense-report", response_model=dict)
async def get_expense_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    business_only: bool = False,
) -> Any:
    """Generate detailed expense report."""
    
    if not start_date:
        start_date = date.today().replace(day=1)
    if not end_date:
        end_date = date.today()
    
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == False,
        Transaction.is_transfer == False,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == False,
    )
    
    if business_only:
        query = query.filter(Transaction.is_business_expense == True)
    
    if category:
        query = query.filter(Transaction.user_category == category)
    
    transactions = query.order_by(desc(Transaction.transaction_date)).all()
    
    by_category = {}
    by_merchant = {}
    daily_totals = {}
    
    for t in transactions:
        cat = t.category_display
        merchant = t.merchant_name or "Unknown"
        day = str(t.transaction_date)
        
        by_category[cat] = by_category.get(cat, 0) + abs(t.amount)
        by_merchant[merchant] = by_merchant.get(merchant, 0) + abs(t.amount)
        daily_totals[day] = daily_totals.get(day, 0) + abs(t.amount)
    
    total = sum(abs(t.amount) for t in transactions)
    
    return {
        "report_type": "expense_report",
        "period": {"start": str(start_date), "end": str(end_date)},
        "filters": {"category": category, "business_only": business_only},
        "total": total,
        "transaction_count": len(transactions),
        "by_category": dict(sorted(by_category.items(), key=lambda x: -x[1])),
        "by_merchant": dict(sorted(by_merchant.items(), key=lambda x: -x[1])[:20]),
        "daily_totals": daily_totals,
        "transactions": [t.to_summary_dict() for t in transactions[:100]],
    }


@router.get("/income-report", response_model=dict)
async def get_income_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Generate income report."""
    
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_income == True,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == False,
    ).order_by(desc(Transaction.transaction_date)).all()
    
    by_source = {}
    monthly_totals = {}
    
    for t in transactions:
        source = t.merchant_name or "Other"
        month = t.transaction_date.strftime("%Y-%m")
        
        by_source[source] = by_source.get(source, 0) + abs(t.amount)
        monthly_totals[month] = monthly_totals.get(month, 0) + abs(t.amount)
    
    total = sum(abs(t.amount) for t in transactions)
    
    return {
        "report_type": "income_report",
        "period": {"start": str(start_date), "end": str(end_date)},
        "total": total,
        "transaction_count": len(transactions),
        "by_source": dict(sorted(by_source.items(), key=lambda x: -x[1])),
        "monthly_totals": dict(sorted(monthly_totals.items())),
        "transactions": [t.to_summary_dict() for t in transactions[:100]],
    }


@router.get("/invoice-report", response_model=dict)
async def get_invoice_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Any:
    """Generate invoice/receivables report."""
    
    if not start_date:
        start_date = date(date.today().year, 1, 1)
    if not end_date:
        end_date = date.today()
    
    invoices = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.issue_date >= start_date,
        Invoice.issue_date <= end_date,
        Invoice.is_deleted == False,
    ).all()
    
    total_invoiced = sum(i.total_amount for i in invoices)
    total_paid = sum(i.amount_paid for i in invoices)
    total_outstanding = sum(i.amount_due for i in invoices if i.status != InvoiceStatus.PAID)
    
    by_client = {}
    by_status = {}
    monthly_totals = {}
    
    for inv in invoices:
        client = inv.client_name or "Unknown"
        status = inv.status.value
        month = inv.issue_date.strftime("%Y-%m")
        
        if client not in by_client:
            by_client[client] = {"invoiced": 0, "paid": 0, "outstanding": 0, "count": 0}
        by_client[client]["invoiced"] += inv.total_amount
        by_client[client]["paid"] += inv.amount_paid
        by_client[client]["outstanding"] += inv.amount_due
        by_client[client]["count"] += 1
        
        by_status[status] = by_status.get(status, 0) + inv.total_amount
        monthly_totals[month] = monthly_totals.get(month, 0) + inv.total_amount
    
    return {
        "report_type": "invoice_report",
        "period": {"start": str(start_date), "end": str(end_date)},
        "summary": {
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "total_outstanding": total_outstanding,
            "collection_rate": (total_paid / total_invoiced * 100) if total_invoiced > 0 else 0,
            "invoice_count": len(invoices),
        },
        "by_client": by_client,
        "by_status": by_status,
        "monthly_totals": dict(sorted(monthly_totals.items())),
    }


@router.get("/export/transactions", response_class=StreamingResponse)
async def export_transactions_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> StreamingResponse:
    """Export transactions as CSV."""
    
    if not start_date:
        start_date = date.today() - timedelta(days=365)
    if not end_date:
        end_date = date.today()
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
        Transaction.is_deleted == False,
    ).order_by(desc(Transaction.transaction_date)).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "Date", "Merchant", "Description", "Amount", "Category",
        "Is Business", "Is Tax Deductible", "Schedule C Category", "Account"
    ])
    
    for t in transactions:
        writer.writerow([
            str(t.transaction_date),
            t.merchant_name or t.name,
            t.description,
            t.amount,
            t.category_display,
            "Yes" if t.is_business_expense else "No",
            "Yes" if t.is_tax_deductible else "No",
            t.schedule_c_category.value if t.schedule_c_category else "",
            t.account.display_name if t.account else "",
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=transactions_{start_date}_{end_date}.csv"
        }
    )
