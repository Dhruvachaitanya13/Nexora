from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel, Field

from app.api.deps import (
    get_db, get_current_user, get_ai_engine, get_financial_context,
    check_feature_access
)
from app.models.user import User
from app.models.transaction import Transaction, ScheduleCCategory
from app.models.tax import TaxEstimate, TaxPayment, TaxDeduction, QuarterlyTax, Quarter, PaymentStatus
from app.services.ai.engine import AIEngine
from app.services.ai.context import FinancialContext

router = APIRouter()


class TaxEstimateRequest(BaseModel):
    tax_year: Optional[str] = None
    gross_income: Optional[float] = None
    deductions: Optional[float] = None
    filing_status: Optional[str] = None
    state: Optional[str] = "IL"


class TaxPaymentCreate(BaseModel):
    tax_year: str
    quarter: str
    amount: float
    payment_date: date
    payment_method: Optional[str] = None
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None


class TaxDeductionCreate(BaseModel):
    tax_year: str
    deduction_type: str
    description: str
    amount: float
    schedule_c_line: Optional[str] = None
    category: Optional[str] = None
    is_verified: bool = False
    documentation_url: Optional[str] = None
    notes: Optional[str] = None


@router.get("/summary", response_model=dict)
async def get_tax_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
    tax_year: Optional[str] = None,
) -> Any:
    """Get comprehensive tax summary for the year."""
    
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
    
    total_income = sum(abs(t.amount) for t in income_txns)
    total_business_expenses = sum(abs(t.amount) for t in expense_txns)
    total_deductible = sum(t.tax_deduction_amount for t in expense_txns if t.is_tax_deductible)
    
    by_schedule_c = {}
    for t in expense_txns:
        if t.schedule_c_category:
            cat = t.schedule_c_category.value
            if cat not in by_schedule_c:
                by_schedule_c[cat] = {"amount": 0, "count": 0, "deductible": 0}
            by_schedule_c[cat]["amount"] += abs(t.amount)
            by_schedule_c[cat]["count"] += 1
            by_schedule_c[cat]["deductible"] += t.tax_deduction_amount
    
    payments = db.query(TaxPayment).filter(
        TaxPayment.user_id == current_user.id,
        TaxPayment.tax_year == tax_year,
    ).all()
    
    total_paid = sum(p.amount_paid for p in payments)
    
    return {
        "tax_year": tax_year,
        "income": {
            "gross_income": total_income,
            "projected_annual": context.income.projected_annual,
        },
        "deductions": {
            "total_business_expenses": total_business_expenses,
            "total_deductible": total_deductible,
            "by_schedule_c": dict(sorted(by_schedule_c.items(), key=lambda x: -x[1]["deductible"])),
        },
        "estimated_tax": {
            "federal": context.tax.federal_tax,
            "state": context.tax.state_tax,
            "self_employment": context.tax.self_employment_tax,
            "total": context.tax.estimated_annual_tax,
            "effective_rate": context.tax.effective_tax_rate,
            "marginal_rate": context.tax.marginal_tax_rate,
        },
        "payments": {
            "total_paid": total_paid,
            "quarterly_due": context.tax.quarterly_payment_due,
            "next_deadline": str(context.tax.next_deadline) if context.tax.next_deadline else None,
            "days_until_deadline": context.tax.days_until_deadline,
        },
        "reserve": {
            "current": context.tax.tax_reserve_current,
            "target": context.tax.tax_reserve_target,
            "shortfall": context.tax.tax_reserve_shortfall,
        },
    }


@router.post("/estimate", response_model=dict)
async def calculate_tax_estimate(
    request: TaxEstimateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Calculate detailed tax estimate."""
    
    tax_year = request.tax_year or str(date.today().year)
    gross_income = request.gross_income or context.income.ytd_income
    deductions = request.deductions or context.expenses.tax_deductible
    filing_status = request.filing_status or context.filing_status
    state = request.state or context.state
    
    se_income = gross_income * 0.9235
    se_tax = min(se_income, 168600) * 0.153
    if se_income > 200000:
        se_tax += (se_income - 200000) * 0.009
    
    se_deduction = se_tax * 0.5
    
    standard_deductions = {
        "single": 14600,
        "married_filing_jointly": 29200,
        "married_filing_separately": 14600,
        "head_of_household": 21900,
    }
    std_deduction = standard_deductions.get(filing_status, 14600)
    
    qbi_deduction = min(gross_income * 0.20, 30000)
    
    taxable_income = max(0, gross_income - deductions - se_deduction - std_deduction - qbi_deduction)
    
    brackets = [
        (11600, 0.10), (47150, 0.12), (100525, 0.22),
        (191950, 0.24), (243725, 0.32), (609350, 0.35), (float('inf'), 0.37)
    ]
    
    federal_tax = 0
    remaining = taxable_income
    prev_limit = 0
    marginal_rate = 0.10
    
    for limit, rate in brackets:
        if remaining <= 0:
            break
        bracket_income = min(remaining, limit - prev_limit)
        federal_tax += bracket_income * rate
        remaining -= bracket_income
        marginal_rate = rate
        prev_limit = limit
    
    state_rates = {
        "IL": 0.0495, "CA": 0.133, "NY": 0.109, "TX": 0.0, "FL": 0.0,
        "WA": 0.0, "NV": 0.0, "PA": 0.0307, "OH": 0.04, "GA": 0.055,
    }
    state_rate = state_rates.get(state, 0.05)
    state_tax = gross_income * state_rate
    
    total_tax = federal_tax + state_tax + se_tax
    effective_rate = (total_tax / gross_income * 100) if gross_income > 0 else 0
    
    quarterly_estimate = total_tax / 4
    
    estimate = TaxEstimate(
        user_id=current_user.id,
        tax_year=tax_year,
        filing_status=filing_status,
        gross_income=gross_income,
        business_income=gross_income,
        total_deductions=deductions + se_deduction + std_deduction + qbi_deduction,
        standard_deduction=std_deduction,
        business_deductions=deductions,
        qbi_deduction=qbi_deduction,
        se_tax_deduction=se_deduction,
        taxable_income=taxable_income,
        federal_tax=federal_tax,
        federal_marginal_rate=marginal_rate * 100,
        state_tax=state_tax,
        state_tax_rate=state_rate * 100,
        state=state,
        self_employment_tax=se_tax,
        total_tax=total_tax,
        effective_tax_rate=effective_rate,
        quarterly_payment_required=quarterly_estimate,
        period_start=date(int(tax_year), 1, 1),
        period_end=date(int(tax_year), 12, 31),
    )
    
    db.add(estimate)
    db.commit()
    db.refresh(estimate)
    
    return estimate.to_dict()


@router.get("/quarterly", response_model=dict)
async def get_quarterly_taxes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tax_year: Optional[str] = None,
) -> Any:
    """Get quarterly tax breakdown and status."""
    
    if not tax_year:
        tax_year = str(date.today().year)
    
    quarters = db.query(QuarterlyTax).filter(
        QuarterlyTax.user_id == current_user.id,
        QuarterlyTax.tax_year == tax_year,
    ).order_by(QuarterlyTax.quarter).all()
    
    if not quarters:
        quarter_info = [
            (Quarter.Q1, date(int(tax_year), 1, 1), date(int(tax_year), 3, 31), date(int(tax_year), 4, 15)),
            (Quarter.Q2, date(int(tax_year), 4, 1), date(int(tax_year), 5, 31), date(int(tax_year), 6, 17)),
            (Quarter.Q3, date(int(tax_year), 6, 1), date(int(tax_year), 8, 31), date(int(tax_year), 9, 16)),
            (Quarter.Q4, date(int(tax_year), 9, 1), date(int(tax_year), 12, 31), date(int(tax_year) + 1, 1, 15)),
        ]
        
        for q, start, end, due in quarter_info:
            quarter = QuarterlyTax(
                user_id=current_user.id,
                tax_year=tax_year,
                quarter=q,
                period_start=start,
                period_end=end,
                due_date=due,
            )
            db.add(quarter)
        
        db.commit()
        quarters = db.query(QuarterlyTax).filter(
            QuarterlyTax.user_id == current_user.id,
            QuarterlyTax.tax_year == tax_year,
        ).order_by(QuarterlyTax.quarter).all()
    
    return {
        "tax_year": tax_year,
        "quarters": [q.to_dict() for q in quarters],
        "summary": {
            "total_due": sum(q.quarterly_tax_due for q in quarters),
            "total_paid": sum(q.payment_amount for q in quarters),
            "remaining": sum(q.quarterly_tax_due - q.payment_amount for q in quarters if not q.is_paid),
        }
    }


@router.get("/payments", response_model=dict)
async def get_tax_payments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tax_year: Optional[str] = None,
) -> Any:
    """Get all tax payments."""
    
    query = db.query(TaxPayment).filter(TaxPayment.user_id == current_user.id)
    
    if tax_year:
        query = query.filter(TaxPayment.tax_year == tax_year)
    
    payments = query.order_by(desc(TaxPayment.due_date)).all()
    
    return {
        "payments": [p.to_dict() for p in payments],
        "total_paid": sum(p.amount_paid for p in payments),
    }


@router.post("/payments", response_model=dict, status_code=status.HTTP_201_CREATED)
async def record_tax_payment(
    payment_data: TaxPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Record a tax payment."""
    
    try:
        quarter = Quarter(payment_data.quarter)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid quarter. Use Q1, Q2, Q3, or Q4",
        )
    
    quarterly = db.query(QuarterlyTax).filter(
        QuarterlyTax.user_id == current_user.id,
        QuarterlyTax.tax_year == payment_data.tax_year,
        QuarterlyTax.quarter == quarter,
    ).first()
    
    payment = TaxPayment(
        user_id=current_user.id,
        tax_year=payment_data.tax_year,
        quarter=quarter,
        amount_due=quarterly.quarterly_tax_due if quarterly else payment_data.amount,
        amount_paid=payment_data.amount,
        due_date=quarterly.due_date if quarterly else date.today(),
        paid_date=payment_data.payment_date,
        status=PaymentStatus.PAID,
        payment_method=payment_data.payment_method,
        confirmation_number=payment_data.confirmation_number,
        notes=payment_data.notes,
    )
    
    db.add(payment)
    
    if quarterly:
        quarterly.record_payment(payment_data.amount, payment_data.payment_date)
    
    db.commit()
    db.refresh(payment)
    
    return payment.to_dict()


@router.get("/deductions", response_model=dict)
async def get_tax_deductions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tax_year: Optional[str] = None,
) -> Any:
    """Get tax deductions summary."""
    
    if not tax_year:
        tax_year = str(date.today().year)
    
    year_start = date(int(tax_year), 1, 1)
    year_end = date(int(tax_year), 12, 31)
    
    transactions = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.is_tax_deductible == True,
        Transaction.transaction_date >= year_start,
        Transaction.transaction_date <= year_end,
    ).all()
    
    by_category = {}
    for t in transactions:
        cat = t.schedule_c_category.value if t.schedule_c_category else "other"
        if cat not in by_category:
            by_category[cat] = {
                "total_amount": 0,
                "deductible_amount": 0,
                "count": 0,
                "transactions": [],
            }
        by_category[cat]["total_amount"] += abs(t.amount)
        by_category[cat]["deductible_amount"] += t.tax_deduction_amount
        by_category[cat]["count"] += 1
    
    schedule_c_lines = {
        "advertising": "Line 8",
        "car_and_truck": "Line 9",
        "commissions_and_fees": "Line 10",
        "contract_labor": "Line 11",
        "depreciation": "Line 13",
        "insurance": "Line 15",
        "interest_mortgage": "Line 16a",
        "interest_other": "Line 16b",
        "legal_and_professional": "Line 17",
        "office_expense": "Line 18",
        "rent_equipment": "Line 20a",
        "rent_property": "Line 20b",
        "repairs_and_maintenance": "Line 21",
        "supplies": "Line 22",
        "taxes_and_licenses": "Line 23",
        "travel": "Line 24a",
        "meals": "Line 24b",
        "utilities": "Line 25",
        "wages": "Line 26",
        "home_office": "Line 30",
        "other": "Line 27a",
    }
    
    deductions_formatted = []
    for cat, data in sorted(by_category.items(), key=lambda x: -x[1]["deductible_amount"]):
        deductions_formatted.append({
            "category": cat,
            "schedule_c_line": schedule_c_lines.get(cat, "Other"),
            "total_amount": data["total_amount"],
            "deductible_amount": data["deductible_amount"],
            "transaction_count": data["count"],
        })
    
    return {
        "tax_year": tax_year,
        "total_deductible": sum(d["deductible_amount"] for d in deductions_formatted),
        "deductions": deductions_formatted,
    }


@router.get("/schedule-c", response_model=dict)
async def get_schedule_c_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    context: FinancialContext = Depends(get_financial_context),
    tax_year: Optional[str] = None,
) -> Any:
    """Generate Schedule C report data."""
    
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
    
    gross_receipts = sum(abs(t.amount) for t in income_txns)
    
    expenses_by_line = {}
    for t in expense_txns:
        cat = t.schedule_c_category.value if t.schedule_c_category else "other"
        expenses_by_line[cat] = expenses_by_line.get(cat, 0) + t.tax_deduction_amount
    
    total_expenses = sum(expenses_by_line.values())
    net_profit = gross_receipts - total_expenses
    
    return {
        "tax_year": tax_year,
        "part_i_income": {
            "line_1_gross_receipts": gross_receipts,
            "line_3_gross_profit": gross_receipts,
            "line_7_gross_income": gross_receipts,
        },
        "part_ii_expenses": {
            "line_8_advertising": expenses_by_line.get("advertising", 0),
            "line_9_car_truck": expenses_by_line.get("car_and_truck", 0),
            "line_10_commissions": expenses_by_line.get("commissions_and_fees", 0),
            "line_11_contract_labor": expenses_by_line.get("contract_labor", 0),
            "line_13_depreciation": expenses_by_line.get("depreciation", 0),
            "line_15_insurance": expenses_by_line.get("insurance", 0),
            "line_16a_mortgage_interest": expenses_by_line.get("interest_mortgage", 0),
            "line_16b_other_interest": expenses_by_line.get("interest_other", 0),
            "line_17_legal_professional": expenses_by_line.get("legal_and_professional", 0),
            "line_18_office_expense": expenses_by_line.get("office_expense", 0),
            "line_20a_rent_equipment": expenses_by_line.get("rent_equipment", 0),
            "line_20b_rent_property": expenses_by_line.get("rent_property", 0),
            "line_21_repairs": expenses_by_line.get("repairs_and_maintenance", 0),
            "line_22_supplies": expenses_by_line.get("supplies", 0),
            "line_23_taxes_licenses": expenses_by_line.get("taxes_and_licenses", 0),
            "line_24a_travel": expenses_by_line.get("travel", 0),
            "line_24b_meals": expenses_by_line.get("meals", 0),
            "line_25_utilities": expenses_by_line.get("utilities", 0),
            "line_26_wages": expenses_by_line.get("wages", 0),
            "line_27a_other": expenses_by_line.get("other", 0),
            "line_28_total_expenses": total_expenses,
        },
        "line_29_tentative_profit": net_profit,
        "line_30_home_office": expenses_by_line.get("home_office", 0),
        "line_31_net_profit_loss": net_profit - expenses_by_line.get("home_office", 0),
    }


@router.get("/deadlines", response_model=dict)
async def get_tax_deadlines(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get upcoming tax deadlines."""
    
    today = date.today()
    year = today.year
    
    deadlines = [
        {"name": "Q1 Estimated Tax", "date": date(year, 4, 15), "type": "quarterly"},
        {"name": "Q2 Estimated Tax", "date": date(year, 6, 17), "type": "quarterly"},
        {"name": "Q3 Estimated Tax", "date": date(year, 9, 16), "type": "quarterly"},
        {"name": "Q4 Estimated Tax", "date": date(year + 1, 1, 15), "type": "quarterly"},
        {"name": "Tax Return Due (or extension)", "date": date(year, 4, 15), "type": "annual"},
        {"name": "Extended Return Due", "date": date(year, 10, 15), "type": "annual"},
        {"name": "1099-NEC Filing", "date": date(year, 1, 31), "type": "annual"},
    ]
    
    upcoming = []
    for d in deadlines:
        if d["date"] >= today:
            days_until = (d["date"] - today).days
            upcoming.append({
                "name": d["name"],
                "date": str(d["date"]),
                "type": d["type"],
                "days_until": days_until,
                "is_urgent": days_until <= 14,
                "is_imminent": days_until <= 7,
            })
    
    upcoming.sort(key=lambda x: x["days_until"])
    
    return {
        "deadlines": upcoming[:10],
        "next_deadline": upcoming[0] if upcoming else None,
    }


@router.post("/ai-advice", response_model=dict)
async def get_ai_tax_advice(
    question: Optional[str] = None,
    current_user: User = Depends(check_feature_access("tax_optimization")),
    db: Session = Depends(get_db),
    engine: AIEngine = Depends(get_ai_engine),
    context: FinancialContext = Depends(get_financial_context),
) -> Any:
    """Get AI-powered tax advice."""
    
    response = await engine.get_tax_advice(context, question)
    
    try:
        import json
        return json.loads(response.content)
    except:
        return {"advice": response.content, "success": response.success}
