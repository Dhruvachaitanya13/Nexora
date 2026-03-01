import asyncio
import statistics
import json
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from dataclasses import dataclass, field, asdict
from decimal import Decimal
from enum import Enum
from collections import defaultdict
import hashlib

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, desc

from app.core.config import settings
from app.models.user import User
from app.models.account import Account, AccountType
from app.models.transaction import Transaction, ScheduleCCategory
from app.models.invoice import Invoice, InvoiceStatus
from app.models.income_source import IncomeSource, Client
from app.models.goal import Goal
from app.models.tax import TaxEstimate, TaxPayment, QuarterlyTax

logger = logging.getLogger(__name__)


class IncomeVariability(str, Enum):
    VERY_LOW = "very_low"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class FinancialHealth(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    URGENT = "urgent"
    CRITICAL = "critical"


@dataclass
class AccountSummary:
    total_balance: float = 0.0
    available_balance: float = 0.0
    checking_balance: float = 0.0
    savings_balance: float = 0.0
    credit_balance: float = 0.0
    credit_limit: float = 0.0
    credit_utilization: float = 0.0
    investment_balance: float = 0.0
    account_count: int = 0
    accounts: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class IncomeSummary:
    period_income: float = 0.0
    ytd_income: float = 0.0
    last_month_income: float = 0.0
    average_monthly_income: float = 0.0
    median_monthly_income: float = 0.0
    income_variability: IncomeVariability = IncomeVariability.MEDIUM
    variability_coefficient: float = 0.0
    income_sources: Dict[str, float] = field(default_factory=dict)
    top_clients: List[Dict[str, Any]] = field(default_factory=list)
    recurring_income: float = 0.0
    variable_income: float = 0.0
    monthly_trend: List[Dict[str, Any]] = field(default_factory=list)
    projected_annual: float = 0.0
    yoy_growth: Optional[float] = None


@dataclass
class ExpenseSummary:
    period_expenses: float = 0.0
    ytd_expenses: float = 0.0
    last_month_expenses: float = 0.0
    average_monthly_expenses: float = 0.0
    expenses_by_category: Dict[str, float] = field(default_factory=dict)
    business_expenses: float = 0.0
    personal_expenses: float = 0.0
    tax_deductible: float = 0.0
    recurring_expenses: float = 0.0
    variable_expenses: float = 0.0
    subscriptions: List[Dict[str, Any]] = field(default_factory=list)
    monthly_trend: List[Dict[str, Any]] = field(default_factory=list)
    largest_expenses: List[Dict[str, Any]] = field(default_factory=list)
    spending_velocity: float = 0.0


@dataclass  
class TaxSummary:
    estimated_annual_tax: float = 0.0
    federal_tax: float = 0.0
    state_tax: float = 0.0
    self_employment_tax: float = 0.0
    effective_tax_rate: float = 0.0
    marginal_tax_rate: float = 0.0
    quarterly_payment_due: float = 0.0
    next_deadline: Optional[date] = None
    days_until_deadline: Optional[int] = None
    ytd_payments_made: float = 0.0
    estimated_refund_or_due: float = 0.0
    tax_reserve_target: float = 0.0
    tax_reserve_current: float = 0.0
    tax_reserve_shortfall: float = 0.0
    potential_deductions: float = 0.0
    deductions_by_category: Dict[str, float] = field(default_factory=dict)


@dataclass
class InvoiceSummary:
    total_outstanding: float = 0.0
    total_overdue: float = 0.0
    total_paid_period: float = 0.0
    total_paid_ytd: float = 0.0
    invoice_count_outstanding: int = 0
    invoice_count_overdue: int = 0
    average_days_to_payment: float = 0.0
    collection_rate: float = 0.0
    overdue_by_client: Dict[str, float] = field(default_factory=dict)
    upcoming_due: List[Dict[str, Any]] = field(default_factory=list)
    aging_buckets: Dict[str, float] = field(default_factory=dict)


@dataclass
class CashFlowSummary:
    current_runway_months: float = 0.0
    net_cash_flow_period: float = 0.0
    net_cash_flow_ytd: float = 0.0
    average_monthly_net: float = 0.0
    burn_rate: float = 0.0
    savings_rate: float = 0.0
    days_until_zero: Optional[int] = None
    projected_balance_30d: float = 0.0
    projected_balance_60d: float = 0.0
    projected_balance_90d: float = 0.0
    cash_flow_trend: str = "stable"
    upcoming_large_expenses: List[Dict[str, Any]] = field(default_factory=list)
    upcoming_expected_income: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class GoalsSummary:
    active_goals: int = 0
    goals_on_track: int = 0
    goals_behind: int = 0
    total_target: float = 0.0
    total_current: float = 0.0
    overall_progress: float = 0.0
    goals: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class DataQualitySummary:
    uncategorized_count: int = 0
    uncategorized_amount: float = 0.0
    potential_duplicates: int = 0
    missing_receipts: int = 0
    missing_receipts_amount: float = 0.0
    accounts_needing_sync: int = 0
    data_freshness_hours: float = 0.0
    categorization_rate: float = 0.0
    review_needed_count: int = 0


@dataclass
class Alert:
    alert_type: str
    severity: AlertSeverity
    title: str
    message: str
    action_required: bool = False
    action_url: Optional[str] = None
    amount: Optional[float] = None
    deadline: Optional[date] = None
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.alert_type,
            "severity": self.severity.value,
            "title": self.title,
            "message": self.message,
            "action_required": self.action_required,
            "action_url": self.action_url,
            "amount": self.amount,
            "deadline": str(self.deadline) if self.deadline else None,
        }


@dataclass
class FinancialContext:
    user_id: str
    user_name: str
    business_type: str
    filing_status: str
    state: str
    
    context_date: date = field(default_factory=date.today)
    period_start: date = None
    period_end: date = None
    
    accounts: AccountSummary = field(default_factory=AccountSummary)
    income: IncomeSummary = field(default_factory=IncomeSummary)
    expenses: ExpenseSummary = field(default_factory=ExpenseSummary)
    tax: TaxSummary = field(default_factory=TaxSummary)
    invoices: InvoiceSummary = field(default_factory=InvoiceSummary)
    cash_flow: CashFlowSummary = field(default_factory=CashFlowSummary)
    goals: GoalsSummary = field(default_factory=GoalsSummary)
    data_quality: DataQualitySummary = field(default_factory=DataQualitySummary)
    
    financial_health: FinancialHealth = FinancialHealth.FAIR
    health_score: int = 50
    health_factors: Dict[str, int] = field(default_factory=dict)
    
    alerts: List[Alert] = field(default_factory=list)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    
    anomalies: List[Dict[str, Any]] = field(default_factory=list)
    trends: Dict[str, Any] = field(default_factory=dict)
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.utcnow)
    cache_key: str = ""
    
    def to_prompt(self) -> str:
        return f"""
═══════════════════════════════════════════════════════════════════════════════
                    FINANCIAL CONTEXT FOR: {self.user_name}
                    Business Type: {self.business_type} | State: {self.state}
                    Period: {self.period_start} to {self.period_end}
═══════════════════════════════════════════════════════════════════════════════

📊 FINANCIAL HEALTH SCORE: {self.health_score}/100 ({self.financial_health.value.upper()})
   Factors: {json.dumps(self.health_factors)}

💰 ACCOUNT BALANCES
   ├─ Total Balance: ${self.accounts.total_balance:,.2f}
   ├─ Checking: ${self.accounts.checking_balance:,.2f}
   ├─ Savings: ${self.accounts.savings_balance:,.2f}
   ├─ Credit Used: ${abs(self.accounts.credit_balance):,.2f} / ${self.accounts.credit_limit:,.2f} ({self.accounts.credit_utilization:.1f}%)
   └─ Investments: ${self.accounts.investment_balance:,.2f}

📈 INCOME (Period / YTD)
   ├─ Period Income: ${self.income.period_income:,.2f}
   ├─ YTD Income: ${self.income.ytd_income:,.2f}
   ├─ Monthly Average: ${self.income.average_monthly_income:,.2f}
   ├─ Variability: {self.income.income_variability.value} (CV: {self.income.variability_coefficient:.1f}%)
   ├─ Recurring: ${self.income.recurring_income:,.2f} | Variable: ${self.income.variable_income:,.2f}
   └─ Projected Annual: ${self.income.projected_annual:,.2f}
   
   Top Income Sources:
{self._format_income_sources()}

📉 EXPENSES (Period / YTD)  
   ├─ Period Expenses: ${self.expenses.period_expenses:,.2f}
   ├─ YTD Expenses: ${self.expenses.ytd_expenses:,.2f}
   ├─ Monthly Average: ${self.expenses.average_monthly_expenses:,.2f}
   ├─ Business: ${self.expenses.business_expenses:,.2f} | Personal: ${self.expenses.personal_expenses:,.2f}
   ├─ Tax Deductible: ${self.expenses.tax_deductible:,.2f}
   └─ Subscriptions: ${self.expenses.recurring_expenses:,.2f}/month
   
   By Category:
{self._format_expenses_by_category()}

🧾 TAX SITUATION
   ├─ Estimated Annual Tax: ${self.tax.estimated_annual_tax:,.2f}
   │   ├─ Federal: ${self.tax.federal_tax:,.2f}
   │   ├─ State ({self.state}): ${self.tax.state_tax:,.2f}
   │   └─ Self-Employment: ${self.tax.self_employment_tax:,.2f}
   ├─ Effective Rate: {self.tax.effective_tax_rate:.1f}% | Marginal: {self.tax.marginal_tax_rate:.1f}%
   ├─ Next Quarterly Due: ${self.tax.quarterly_payment_due:,.2f} on {self.tax.next_deadline} ({self.tax.days_until_deadline} days)
   ├─ Tax Reserve: ${self.tax.tax_reserve_current:,.2f} / ${self.tax.tax_reserve_target:,.2f} (Shortfall: ${self.tax.tax_reserve_shortfall:,.2f})
   └─ Potential Unclaimed Deductions: ${self.tax.potential_deductions:,.2f}

📄 INVOICES & RECEIVABLES
   ├─ Outstanding: ${self.invoices.total_outstanding:,.2f} ({self.invoices.invoice_count_outstanding} invoices)
   ├─ Overdue: ${self.invoices.total_overdue:,.2f} ({self.invoices.invoice_count_overdue} invoices)
   ├─ Average Days to Payment: {self.invoices.average_days_to_payment:.1f} days
   └─ Collection Rate: {self.invoices.collection_rate:.1f}%

�� CASH FLOW
   ├─ Runway: {self.cash_flow.current_runway_months:.1f} months
   ├─ Net Cash Flow (Period): ${self.cash_flow.net_cash_flow_period:,.2f}
   ├─ Savings Rate: {self.cash_flow.savings_rate:.1f}%
   ├─ Burn Rate: ${self.cash_flow.burn_rate:,.2f}/month
   ├─ Trend: {self.cash_flow.cash_flow_trend}
   └─ Projected Balance (30/60/90d): ${self.cash_flow.projected_balance_30d:,.2f} / ${self.cash_flow.projected_balance_60d:,.2f} / ${self.cash_flow.projected_balance_90d:,.2f}

🎯 GOALS
   ├─ Active: {self.goals.active_goals} | On Track: {self.goals.goals_on_track} | Behind: {self.goals.goals_behind}
   └─ Overall Progress: {self.goals.overall_progress:.1f}%

⚠️ DATA QUALITY
   ├─ Uncategorized: {self.data_quality.uncategorized_count} transactions (${self.data_quality.uncategorized_amount:,.2f})
   ├─ Missing Receipts: {self.data_quality.missing_receipts} (${self.data_quality.missing_receipts_amount:,.2f})
   └─ Categorization Rate: {self.data_quality.categorization_rate:.1f}%

🚨 ACTIVE ALERTS ({len(self.alerts)}):
{self._format_alerts()}

═══════════════════════════════════════════════════════════════════════════════
"""
    
    def _format_income_sources(self) -> str:
        if not self.income.income_sources:
            return "   (no data)"
        lines = []
        for source, amount in sorted(self.income.income_sources.items(), key=lambda x: -x[1])[:5]:
            lines.append(f"   ├─ {source}: ${amount:,.2f}")
        return "\n".join(lines)
    
    def _format_expenses_by_category(self) -> str:
        if not self.expenses.expenses_by_category:
            return "   (no data)"
        lines = []
        for cat, amount in sorted(self.expenses.expenses_by_category.items(), key=lambda x: -x[1])[:8]:
            lines.append(f"   ├─ {cat}: ${amount:,.2f}")
        return "\n".join(lines)
    
    def _format_alerts(self) -> str:
        if not self.alerts:
            return "   (none)"
        lines = []
        for alert in self.alerts[:5]:
            icon = {"critical": "🔴", "urgent": "🟠", "warning": "🟡", "info": "🔵"}.get(alert.severity.value, "⚪")
            lines.append(f"   {icon} [{alert.severity.value.upper()}] {alert.title}: {alert.message}")
        return "\n".join(lines)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "user_name": self.user_name,
            "business_type": self.business_type,
            "filing_status": self.filing_status,
            "state": self.state,
            "period": {"start": str(self.period_start), "end": str(self.period_end)},
            "accounts": asdict(self.accounts),
            "income": asdict(self.income),
            "expenses": asdict(self.expenses),
            "tax": asdict(self.tax),
            "invoices": asdict(self.invoices),
            "cash_flow": asdict(self.cash_flow),
            "goals": asdict(self.goals),
            "data_quality": asdict(self.data_quality),
            "financial_health": self.financial_health.value,
            "health_score": self.health_score,
            "health_factors": self.health_factors,
            "alerts": [a.to_dict() for a in self.alerts],
            "generated_at": self.generated_at.isoformat(),
        }
    
    def to_compact_prompt(self) -> str:
        return f"""User: {self.user_name} ({self.business_type}, {self.state})
Balance: ${self.accounts.total_balance:,.0f} | YTD Income: ${self.income.ytd_income:,.0f} | YTD Expenses: ${self.expenses.ytd_expenses:,.0f}
Health: {self.health_score}/100 | Runway: {self.cash_flow.current_runway_months:.1f}mo | Tax Due: ${self.tax.quarterly_payment_due:,.0f} in {self.tax.days_until_deadline}d
Outstanding: ${self.invoices.total_outstanding:,.0f} | Overdue: ${self.invoices.total_overdue:,.0f}
Alerts: {len([a for a in self.alerts if a.severity in [AlertSeverity.CRITICAL, AlertSeverity.URGENT]])} urgent"""


class FinancialContextBuilder:
    def __init__(self, db: Session):
        self.db = db
        self._cache: Dict[str, Tuple[FinancialContext, datetime]] = {}
        self._cache_ttl = timedelta(minutes=5)
    
    async def build(
        self,
        user: User,
        period_days: int = 30,
        force_refresh: bool = False,
    ) -> FinancialContext:
        cache_key = self._get_cache_key(user.id, period_days)
        
        if not force_refresh and cache_key in self._cache:
            cached_context, cached_at = self._cache[cache_key]
            if datetime.utcnow() - cached_at < self._cache_ttl:
                return cached_context
        
        context = await self._build_context(user, period_days)
        context.cache_key = cache_key
        
        self._cache[cache_key] = (context, datetime.utcnow())
        
        return context
    
    async def _build_context(self, user: User, period_days: int) -> FinancialContext:
        now = datetime.utcnow()
        period_end = now.date()
        period_start = period_end - timedelta(days=period_days)
        year_start = date(now.year, 1, 1)
        
        context = FinancialContext(
            user_id=str(user.id),
            user_name=user.full_name or user.email,
            business_type=user.business_type.value if user.business_type else "freelancer",
            filing_status=user.filing_status.value if user.filing_status else "single",
            state=user.state or "IL",
            period_start=period_start,
            period_end=period_end,
        )
        
        await asyncio.gather(
            self._build_accounts_summary(context, user),
            self._build_income_summary(context, user, period_start, period_end, year_start),
            self._build_expenses_summary(context, user, period_start, period_end, year_start),
            self._build_invoice_summary(context, user),
            self._build_goals_summary(context, user),
            self._build_data_quality(context, user),
        )
        
        await self._build_tax_summary(context, user, year_start)
        await self._build_cash_flow_summary(context, user)
        
        self._calculate_health_score(context)
        self._generate_alerts(context, user)
        
        return context
    
    async def _build_accounts_summary(self, context: FinancialContext, user: User) -> None:
        accounts = self.db.query(Account).filter(
            Account.user_id == user.id,
            Account.is_active == True,
            Account.is_hidden == False,
        ).all()
        
        summary = AccountSummary(account_count=len(accounts))
        
        for acc in accounts:
            balance = acc.current_balance or 0
            available = acc.available_balance or balance
            
            if acc.account_type == AccountType.CREDIT:
                summary.credit_balance += balance
                summary.credit_limit += acc.credit_limit or 0
            elif acc.account_type == AccountType.INVESTMENT:
                summary.investment_balance += balance
                summary.total_balance += balance
            elif acc.account_subtype and "savings" in acc.account_subtype.lower():
                summary.savings_balance += balance
                summary.total_balance += balance
                summary.available_balance += available
            else:
                summary.checking_balance += balance
                summary.total_balance += balance
                summary.available_balance += available
            
            summary.accounts.append({
                "id": str(acc.id),
                "name": acc.display_name,
                "type": acc.account_type.value,
                "balance": balance,
                "institution": acc.institution_name,
            })
        
        if summary.credit_limit > 0:
            summary.credit_utilization = (abs(summary.credit_balance) / summary.credit_limit) * 100
        
        context.accounts = summary
    
    async def _build_income_summary(
        self,
        context: FinancialContext,
        user: User,
        period_start: date,
        period_end: date,
        year_start: date,
    ) -> None:
        transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.is_income == True,
            Transaction.transaction_date >= year_start,
        ).all()
        
        summary = IncomeSummary()
        monthly_income = defaultdict(float)
        income_sources = defaultdict(float)
        
        for t in transactions:
            amount = abs(t.amount)
            month_key = t.transaction_date.strftime("%Y-%m")
            monthly_income[month_key] += amount
            
            source = t.merchant_name or t.name or "Other"
            income_sources[source] += amount
            
            if t.transaction_date >= period_start:
                summary.period_income += amount
            
            summary.ytd_income += amount
        
        last_month = (date.today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
        summary.last_month_income = monthly_income.get(last_month, 0)
        
        if monthly_income:
            values = list(monthly_income.values())
            summary.average_monthly_income = statistics.mean(values)
            summary.median_monthly_income = statistics.median(values)
            
            if len(values) >= 2 and summary.average_monthly_income > 0:
                std_dev = statistics.stdev(values)
                cv = (std_dev / summary.average_monthly_income) * 100
                summary.variability_coefficient = cv
                
                if cv < 10:
                    summary.income_variability = IncomeVariability.VERY_LOW
                elif cv < 20:
                    summary.income_variability = IncomeVariability.LOW
                elif cv < 35:
                    summary.income_variability = IncomeVariability.MEDIUM
                elif cv < 50:
                    summary.income_variability = IncomeVariability.HIGH
                else:
                    summary.income_variability = IncomeVariability.VERY_HIGH
        
        summary.income_sources = dict(sorted(income_sources.items(), key=lambda x: -x[1])[:10])
        
        summary.monthly_trend = [
            {"month": k, "amount": v}
            for k, v in sorted(monthly_income.items())[-6:]
        ]
        
        months_elapsed = max(1, (date.today() - year_start).days / 30)
        summary.projected_annual = summary.ytd_income / months_elapsed * 12
        
        context.income = summary
    
    async def _build_expenses_summary(
        self,
        context: FinancialContext,
        user: User,
        period_start: date,
        period_end: date,
        year_start: date,
    ) -> None:
        transactions = self.db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.is_income == False,
            Transaction.is_transfer == False,
            Transaction.transaction_date >= year_start,
        ).all()
        
        summary = ExpenseSummary()
        monthly_expenses = defaultdict(float)
        expenses_by_category = defaultdict(float)
        
        for t in transactions:
            amount = abs(t.amount)
            month_key = t.transaction_date.strftime("%Y-%m")
            monthly_expenses[month_key] += amount
            
            category = t.category_display
            expenses_by_category[category] += amount
            
            if t.transaction_date >= period_start:
                summary.period_expenses += amount
            
            summary.ytd_expenses += amount
            
            if t.is_business_expense:
                summary.business_expenses += amount
            else:
                summary.personal_expenses += amount
            
            if t.is_tax_deductible:
                summary.tax_deductible += t.tax_deduction_amount
            
            if t.is_recurring:
                summary.recurring_expenses += amount / max(1, (date.today() - year_start).days / 30)
        
        last_month = (date.today().replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
        summary.last_month_expenses = monthly_expenses.get(last_month, 0)
        
        if monthly_expenses:
            summary.average_monthly_expenses = statistics.mean(monthly_expenses.values())
        
        summary.expenses_by_category = dict(sorted(expenses_by_category.items(), key=lambda x: -x[1])[:15])
        
        summary.monthly_trend = [
            {"month": k, "amount": v}
            for k, v in sorted(monthly_expenses.items())[-6:]
        ]
        
        summary.largest_expenses = sorted(
            [{"merchant": t.merchant_name, "amount": abs(t.amount), "date": str(t.transaction_date), "category": t.category_display}
             for t in transactions if t.transaction_date >= period_start],
            key=lambda x: -x["amount"]
        )[:10]
        
        context.expenses = summary
    
    async def _build_tax_summary(self, context: FinancialContext, user: User, year_start: date) -> None:
        summary = TaxSummary()
        
        gross_income = context.income.ytd_income
        deductions = context.expenses.tax_deductible
        
        se_income = gross_income * 0.9235
        se_tax = min(se_income, 168600) * 0.153
        if se_income > 200000:
            se_tax += (se_income - 200000) * 0.009
        
        summary.self_employment_tax = se_tax
        se_deduction = se_tax * 0.5
        
        standard_deductions = {
            "single": 14600, "married_filing_jointly": 29200,
            "married_filing_separately": 14600, "head_of_household": 21900,
        }
        std_deduction = standard_deductions.get(context.filing_status, 14600)
        
        taxable_income = max(0, gross_income - deductions - se_deduction - std_deduction)
        
        brackets = [(11600, 0.10), (47150, 0.12), (100525, 0.22), (191950, 0.24), (243725, 0.32), (609350, 0.35), (float('inf'), 0.37)]
        federal_tax = 0
        prev_limit = 0
        marginal_rate = 0.10
        
        remaining = taxable_income
        for limit, rate in brackets:
            if remaining <= 0:
                break
            bracket_income = min(remaining, limit - prev_limit)
            federal_tax += bracket_income * rate
            remaining -= bracket_income
            marginal_rate = rate
            prev_limit = limit
        
        summary.federal_tax = federal_tax
        summary.marginal_tax_rate = marginal_rate * 100
        
        state_rates = {"IL": 0.0495, "CA": 0.0930, "NY": 0.0685, "TX": 0.0, "FL": 0.0}
        state_rate = state_rates.get(context.state, 0.05)
        summary.state_tax = gross_income * state_rate
        
        summary.estimated_annual_tax = federal_tax + summary.state_tax + se_tax
        
        if gross_income > 0:
            summary.effective_tax_rate = (summary.estimated_annual_tax / gross_income) * 100
        
        summary.quarterly_payment_due = summary.estimated_annual_tax / 4
        
        today = date.today()
        year = today.year
        deadlines = [
            (date(year, 4, 15), "Q1"), (date(year, 6, 17), "Q2"),
            (date(year, 9, 16), "Q3"), (date(year + 1, 1, 15), "Q4"),
        ]
        
        for deadline, quarter in deadlines:
            if deadline > today:
                summary.next_deadline = deadline
                summary.days_until_deadline = (deadline - today).days
                break
        
        summary.tax_reserve_target = summary.estimated_annual_tax * 0.3
        
        uncategorized_business = self.db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.is_income == False,
            Transaction.is_business_expense == False,
            Transaction.user_category == None,
        ).all()
        
        business_keywords = ["software", "office", "computer", "professional", "subscription", "hosting", "domain", "adobe", "microsoft", "zoom", "slack"]
        potential = sum(abs(t.amount) for t in uncategorized_business if any(kw in (t.merchant_name or "").lower() for kw in business_keywords))
        summary.potential_deductions = potential
        
        context.tax = summary
    
    async def _build_invoice_summary(self, context: FinancialContext, user: User) -> None:
        invoices = self.db.query(Invoice).filter(
            Invoice.user_id == user.id,
        ).all()
        
        summary = InvoiceSummary()
        overdue_by_client = defaultdict(float)
        aging = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        
        for inv in invoices:
            if inv.status in [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIALLY_PAID]:
                summary.total_outstanding += inv.amount_due
                summary.invoice_count_outstanding += 1
                
                if inv.is_overdue:
                    summary.total_overdue += inv.amount_due
                    summary.invoice_count_overdue += 1
                    overdue_by_client[inv.client_name or "Unknown"] += inv.amount_due
                    
                    days = inv.days_overdue
                    if days <= 30:
                        aging["0-30"] += inv.amount_due
                    elif days <= 60:
                        aging["31-60"] += inv.amount_due
                    elif days <= 90:
                        aging["61-90"] += inv.amount_due
                    else:
                        aging["90+"] += inv.amount_due
            
            if inv.status == InvoiceStatus.PAID and inv.paid_at:
                summary.total_paid_ytd += inv.total_amount
        
        summary.overdue_by_client = dict(overdue_by_client)
        summary.aging_buckets = aging
        
        if summary.total_paid_ytd > 0:
            summary.collection_rate = (summary.total_paid_ytd / (summary.total_paid_ytd + summary.total_outstanding)) * 100
        
        context.invoices = summary
    
    async def _build_cash_flow_summary(self, context: FinancialContext, user: User) -> None:
        summary = CashFlowSummary()
        
        summary.net_cash_flow_period = context.income.period_income - context.expenses.period_expenses
        summary.net_cash_flow_ytd = context.income.ytd_income - context.expenses.ytd_expenses
        
        if context.income.average_monthly_income > 0:
            summary.average_monthly_net = context.income.average_monthly_income - context.expenses.average_monthly_expenses
        
        summary.burn_rate = context.expenses.average_monthly_expenses
        
        if summary.burn_rate > 0:
            summary.current_runway_months = context.accounts.total_balance / summary.burn_rate
            
            if summary.average_monthly_net < 0:
                summary.days_until_zero = int(context.accounts.total_balance / abs(summary.average_monthly_net) * 30)
        
        if context.income.period_income > 0:
            summary.savings_rate = (summary.net_cash_flow_period / context.income.period_income) * 100
        
        summary.projected_balance_30d = context.accounts.total_balance + summary.average_monthly_net
        summary.projected_balance_60d = context.accounts.total_balance + summary.average_monthly_net * 2
        summary.projected_balance_90d = context.accounts.total_balance + summary.average_monthly_net * 3
        
        if len(context.income.monthly_trend) >= 3:
            recent = [m["amount"] for m in context.income.monthly_trend[-3:]]
            if recent[-1] > recent[0] * 1.1:
                summary.cash_flow_trend = "improving"
            elif recent[-1] < recent[0] * 0.9:
                summary.cash_flow_trend = "declining"
            else:
                summary.cash_flow_trend = "stable"
        
        context.cash_flow = summary
    
    async def _build_goals_summary(self, context: FinancialContext, user: User) -> None:
        goals = self.db.query(Goal).filter(
            Goal.user_id == user.id,
            Goal.status.in_(["not_started", "in_progress", "on_track", "behind"]),
        ).all()
        
        summary = GoalsSummary(active_goals=len(goals))
        
        for goal in goals:
            summary.total_target += goal.target_amount
            summary.total_current += goal.current_amount
            
            if goal.status.value in ["on_track", "completed"]:
                summary.goals_on_track += 1
            elif goal.status.value == "behind":
                summary.goals_behind += 1
            
            summary.goals.append({
                "id": str(goal.id),
                "name": goal.name,
                "type": goal.goal_type.value,
                "progress": goal.progress_percentage,
                "target": goal.target_amount,
                "current": goal.current_amount,
            })
        
        if summary.total_target > 0:
            summary.overall_progress = (summary.total_current / summary.total_target) * 100
        
        context.goals = summary
    
    async def _build_data_quality(self, context: FinancialContext, user: User) -> None:
        summary = DataQualitySummary()
        
        uncategorized = self.db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.user_category == None,
            Transaction.is_income == False,
            Transaction.is_transfer == False,
        ).all()
        
        summary.uncategorized_count = len(uncategorized)
        summary.uncategorized_amount = sum(abs(t.amount) for t in uncategorized)
        
        business_no_receipt = self.db.query(Transaction).filter(
            Transaction.user_id == user.id,
            Transaction.is_business_expense == True,
            Transaction.receipt_url == None,
            func.abs(Transaction.amount) >= 75,
        ).count()
        
        summary.missing_receipts = business_no_receipt
        
        total_txns = self.db.query(Transaction).filter(Transaction.user_id == user.id).count()
        categorized = total_txns - summary.uncategorized_count
        if total_txns > 0:
            summary.categorization_rate = (categorized / total_txns) * 100
        
        context.data_quality = summary
    
    def _calculate_health_score(self, context: FinancialContext) -> None:
        factors = {}
        score = 0
        
        if context.cash_flow.current_runway_months >= 6:
            factors["runway"] = 25
        elif context.cash_flow.current_runway_months >= 3:
            factors["runway"] = 15
        elif context.cash_flow.current_runway_months >= 1:
            factors["runway"] = 5
        else:
            factors["runway"] = 0
        score += factors["runway"]
        
        if context.cash_flow.savings_rate >= 20:
            factors["savings"] = 25
        elif context.cash_flow.savings_rate >= 10:
            factors["savings"] = 15
        elif context.cash_flow.savings_rate >= 0:
            factors["savings"] = 5
        else:
            factors["savings"] = 0
        score += factors["savings"]
        
        tax_prep = min(25, (context.tax.tax_reserve_current / max(1, context.tax.tax_reserve_target)) * 25)
        factors["tax_prep"] = int(tax_prep)
        score += factors["tax_prep"]
        
        if context.income.income_variability == IncomeVariability.VERY_LOW:
            factors["stability"] = 15
        elif context.income.income_variability == IncomeVariability.LOW:
            factors["stability"] = 12
        elif context.income.income_variability == IncomeVariability.MEDIUM:
            factors["stability"] = 8
        else:
            factors["stability"] = 3
        score += factors["stability"]
        
        if context.data_quality.categorization_rate >= 90:
            factors["data_quality"] = 10
        elif context.data_quality.categorization_rate >= 70:
            factors["data_quality"] = 6
        else:
            factors["data_quality"] = 2
        score += factors["data_quality"]
        
        context.health_score = min(100, score)
        context.health_factors = factors
        
        if score >= 80:
            context.financial_health = FinancialHealth.EXCELLENT
        elif score >= 60:
            context.financial_health = FinancialHealth.GOOD
        elif score >= 40:
            context.financial_health = FinancialHealth.FAIR
        elif score >= 20:
            context.financial_health = FinancialHealth.POOR
        else:
            context.financial_health = FinancialHealth.CRITICAL
    
    def _generate_alerts(self, context: FinancialContext, user: User) -> None:
        alerts = []
        
        if context.tax.days_until_deadline and context.tax.days_until_deadline <= 7:
            alerts.append(Alert(
                alert_type="tax_deadline",
                severity=AlertSeverity.CRITICAL,
                title="Tax Deadline Imminent",
                message=f"Quarterly tax payment of ${context.tax.quarterly_payment_due:,.2f} due in {context.tax.days_until_deadline} days",
                action_required=True,
                amount=context.tax.quarterly_payment_due,
                deadline=context.tax.next_deadline,
            ))
        elif context.tax.days_until_deadline and context.tax.days_until_deadline <= 14:
            alerts.append(Alert(
                alert_type="tax_deadline",
                severity=AlertSeverity.URGENT,
                title="Tax Deadline Approaching",
                message=f"Quarterly tax payment due in {context.tax.days_until_deadline} days",
                action_required=True,
                deadline=context.tax.next_deadline,
            ))
        
        if context.cash_flow.current_runway_months < 1:
            alerts.append(Alert(
                alert_type="cash_flow",
                severity=AlertSeverity.CRITICAL,
                title="Critical Cash Flow",
                message=f"Less than 1 month of runway remaining (${context.accounts.total_balance:,.2f})",
                action_required=True,
            ))
        elif context.cash_flow.current_runway_months < 2:
            alerts.append(Alert(
                alert_type="cash_flow",
                severity=AlertSeverity.URGENT,
                title="Low Cash Runway",
                message=f"Only {context.cash_flow.current_runway_months:.1f} months of expenses covered",
                action_required=True,
            ))
        
        if context.invoices.total_overdue > 0:
            alerts.append(Alert(
                alert_type="invoices",
                severity=AlertSeverity.WARNING,
                title="Overdue Invoices",
                message=f"{context.invoices.invoice_count_overdue} invoices totaling ${context.invoices.total_overdue:,.2f} are overdue",
                action_required=True,
                amount=context.invoices.total_overdue,
            ))
        
        if context.tax.tax_reserve_shortfall > 1000:
            alerts.append(Alert(
                alert_type="tax_reserve",
                severity=AlertSeverity.WARNING,
                title="Tax Reserve Shortfall",
                message=f"Tax reserve is ${context.tax.tax_reserve_shortfall:,.2f} below target",
                amount=context.tax.tax_reserve_shortfall,
            ))
        
        if context.data_quality.uncategorized_count > 20:
            alerts.append(Alert(
                alert_type="data_quality",
                severity=AlertSeverity.INFO,
                title="Uncategorized Transactions",
                message=f"{context.data_quality.uncategorized_count} transactions need categorization",
            ))
        
        if context.accounts.credit_utilization > 30:
            alerts.append(Alert(
                alert_type="credit",
                severity=AlertSeverity.WARNING if context.accounts.credit_utilization > 50 else AlertSeverity.INFO,
                title="High Credit Utilization",
                message=f"Credit utilization at {context.accounts.credit_utilization:.1f}%",
            ))
        
        context.alerts = sorted(alerts, key=lambda a: ["critical", "urgent", "warning", "info"].index(a.severity.value))
    
    def _get_cache_key(self, user_id, period_days: int) -> str:
        key = f"{user_id}:{period_days}:{date.today()}"
        return hashlib.md5(key.encode()).hexdigest()


class ContextManager:
    _instance = None
    _contexts: Dict[str, FinancialContext] = {}
    
    @classmethod
    def get_instance(cls) -> "ContextManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def store(self, user_id: str, context: FinancialContext) -> None:
        self._contexts[user_id] = context
    
    def get(self, user_id: str) -> Optional[FinancialContext]:
        return self._contexts.get(user_id)
    
    def invalidate(self, user_id: str) -> None:
        if user_id in self._contexts:
            del self._contexts[user_id]
    
    def invalidate_all(self) -> None:
        self._contexts.clear()
