"""
Real-Time Insight Engine - Generates actionable financial insights.
"""
import asyncio
import json
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from app.services.ai.engine import AIEngine
from app.services.ai.context import FinancialContext

logger = logging.getLogger(__name__)


class InsightType(str, Enum):
    TAX_SAVING = "tax_saving"
    EXPENSE_REDUCTION = "expense_reduction"
    INCOME_OPPORTUNITY = "income_opportunity"
    CASH_FLOW_WARNING = "cash_flow_warning"
    SPENDING_PATTERN = "spending_pattern"
    INVOICE_ALERT = "invoice_alert"
    GOAL_PROGRESS = "goal_progress"
    ANOMALY = "anomaly"
    OPTIMIZATION = "optimization"
    COMPLIANCE = "compliance"
    TREND = "trend"


class InsightPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class Insight:
    insight_type: InsightType
    priority: InsightPriority
    title: str
    summary: str
    detailed_explanation: str = ""
    potential_impact: float = 0.0
    confidence: float = 0.7
    action_steps: List[str] = field(default_factory=list)
    evidence: List[str] = field(default_factory=list)
    related_transactions: List[str] = field(default_factory=list)
    related_entities: Dict[str, str] = field(default_factory=dict)
    deadline: Optional[date] = None
    expires_at: Optional[datetime] = None
    is_actionable: bool = True
    requires_user_action: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.insight_type.value,
            "priority": self.priority.value,
            "title": self.title,
            "summary": self.summary,
            "detailed_explanation": self.detailed_explanation,
            "potential_impact": self.potential_impact,
            "confidence": self.confidence,
            "action_steps": self.action_steps,
            "evidence": self.evidence,
            "deadline": str(self.deadline) if self.deadline else None,
            "is_actionable": self.is_actionable,
            "requires_user_action": self.requires_user_action,
            "created_at": self.created_at.isoformat(),
        }


class InsightEngine:
    def __init__(self, engine: AIEngine, db=None):
        self.engine = engine
        self.db = db

    async def generate_all_insights(
        self,
        context: FinancialContext,
        max_insights: int = 10,
    ) -> List[Insight]:
        """Generate all insights for the user."""
        all_insights = []

        generators = [
            self._generate_tax_insights,
            self._generate_cash_flow_insights,
            self._generate_spending_insights,
            self._generate_invoice_insights,
            self._generate_categorization_insights,
            self._generate_trend_insights,
            self._generate_compliance_insights,
        ]

        tasks = [gen(context) for gen in generators]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, list):
                all_insights.extend(result)
            elif isinstance(result, Exception):
                logger.error(f"Insight generation error: {result}")

        all_insights.sort(
            key=lambda x: (
                {"critical": 0, "high": 1, "medium": 2, "low": 3}[x.priority.value],
                -x.potential_impact,
                -x.confidence,
            )
        )

        return all_insights[:max_insights]

    async def _generate_tax_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if context.tax.days_until_deadline and context.tax.days_until_deadline <= 14:
            priority = InsightPriority.CRITICAL if context.tax.days_until_deadline <= 7 else InsightPriority.HIGH
            insights.append(Insight(
                insight_type=InsightType.TAX_SAVING,
                priority=priority,
                title=f"Quarterly Tax Payment Due in {context.tax.days_until_deadline} Days",
                summary=f"Your estimated quarterly tax payment of ${context.tax.quarterly_payment_due:,.2f} is due on {context.tax.next_deadline}.",
                detailed_explanation=f"""Your Q{self._get_quarter()} estimated tax payment is approaching.

Payment breakdown:
- Federal: ${context.tax.federal_tax / 4:,.2f}
- State (IL): ${context.tax.state_tax / 4:,.2f}
- Self-Employment: ${context.tax.self_employment_tax / 4:,.2f}

Missing this deadline may result in underpayment penalties of approximately 8% annually.""",
                potential_impact=context.tax.quarterly_payment_due * 0.02,
                confidence=0.95,
                action_steps=[
                    "Log in to IRS Direct Pay or EFTPS",
                    f"Pay ${context.tax.federal_tax / 4:,.2f} for federal taxes",
                    "Pay state taxes via MyTax Illinois",
                    "Save confirmation numbers",
                ],
                deadline=context.tax.next_deadline,
                requires_user_action=True,
            ))

        if context.tax.tax_reserve_shortfall > 500:
            insights.append(Insight(
                insight_type=InsightType.TAX_SAVING,
                priority=InsightPriority.MEDIUM,
                title="Tax Reserve Below Target",
                summary=f"Your tax reserve is ${context.tax.tax_reserve_shortfall:,.2f} below the recommended amount.",
                potential_impact=context.tax.tax_reserve_shortfall,
                confidence=0.85,
                action_steps=[
                    f"Transfer ${context.tax.tax_reserve_shortfall:,.2f} to tax savings",
                    "Set up automatic 30% transfer from income",
                ],
            ))

        return insights

    async def _generate_cash_flow_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if context.cash_flow.current_runway_months < 2:
            priority = InsightPriority.CRITICAL if context.cash_flow.current_runway_months < 1 else InsightPriority.HIGH
            insights.append(Insight(
                insight_type=InsightType.CASH_FLOW_WARNING,
                priority=priority,
                title=f"Low Cash Runway: {context.cash_flow.current_runway_months:.1f} Months",
                summary=f"At current burn rate, your funds will last approximately {context.cash_flow.current_runway_months:.1f} months.",
                potential_impact=context.cash_flow.burn_rate * 3,
                confidence=0.90,
                action_steps=[
                    "Review and reduce non-essential expenses",
                    "Follow up on outstanding invoices",
                    "Consider accelerating client payments",
                ],
                requires_user_action=True,
            ))

        if context.invoices.total_outstanding > context.income.average_monthly_income * 0.5:
            insights.append(Insight(
                insight_type=InsightType.CASH_FLOW_WARNING,
                priority=InsightPriority.MEDIUM,
                title="High Outstanding Receivables",
                summary=f"You have ${context.invoices.total_outstanding:,.2f} in outstanding invoices.",
                potential_impact=context.invoices.total_outstanding * 0.9,
                confidence=0.85,
                action_steps=[
                    "Send payment reminders to clients",
                    "Follow up on overdue invoices",
                    "Consider offering early payment discounts",
                ],
            ))

        return insights

    async def _generate_spending_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if context.expenses.recurring_expenses > context.income.average_monthly_income * 0.4:
            insights.append(Insight(
                insight_type=InsightType.EXPENSE_REDUCTION,
                priority=InsightPriority.MEDIUM,
                title="High Recurring Expenses",
                summary=f"Recurring expenses are {(context.expenses.recurring_expenses / context.income.average_monthly_income * 100):.0f}% of your income.",
                potential_impact=context.expenses.recurring_expenses * 0.15,
                confidence=0.80,
                action_steps=[
                    "Review all subscriptions",
                    "Cancel unused services",
                    "Negotiate better rates",
                ],
            ))

        return insights

    async def _generate_invoice_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if context.invoices.total_overdue > 0:
            insights.append(Insight(
                insight_type=InsightType.INVOICE_ALERT,
                priority=InsightPriority.HIGH,
                title=f"${context.invoices.total_overdue:,.2f} in Overdue Invoices",
                summary=f"You have {context.invoices.invoice_count_overdue} overdue invoices totaling ${context.invoices.total_overdue:,.2f}.",
                potential_impact=context.invoices.total_overdue,
                confidence=0.95,
                action_steps=[
                    "Send payment reminders immediately",
                    "Call clients with invoices 30+ days overdue",
                    "Consider late payment fees",
                ],
                requires_user_action=True,
            ))

        return insights

    async def _generate_categorization_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if context.data_quality.uncategorized_count > 10:
            potential_deductions = context.data_quality.uncategorized_amount * 0.3
            insights.append(Insight(
                insight_type=InsightType.TAX_SAVING,
                priority=InsightPriority.MEDIUM,
                title=f"{context.data_quality.uncategorized_count} Uncategorized Transactions",
                summary=f"Categorizing these could reveal up to ${potential_deductions:,.2f} in tax deductions.",
                potential_impact=potential_deductions,
                confidence=0.70,
                action_steps=[
                    "Review uncategorized transactions",
                    "Use AI auto-categorization",
                    "Set up rules for recurring merchants",
                ],
            ))

        return insights

    async def _generate_trend_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        if len(context.income.monthly_trend) >= 3:
            recent = [t["amount"] for t in context.income.monthly_trend[-3:]]
            if all(recent[i] < recent[i-1] * 0.9 for i in range(1, len(recent))):
                insights.append(Insight(
                    insight_type=InsightType.TREND,
                    priority=InsightPriority.HIGH,
                    title="Declining Income Trend",
                    summary="Your income has decreased for 3 consecutive months.",
                    confidence=0.80,
                    action_steps=[
                        "Reach out to existing clients for more work",
                        "Update marketing efforts",
                        "Consider new income streams",
                    ],
                ))

        return insights

    async def _generate_compliance_insights(self, context: FinancialContext) -> List[Insight]:
        insights = []

        today = date.today()
        if today.month == 12:
            insights.append(Insight(
                insight_type=InsightType.COMPLIANCE,
                priority=InsightPriority.MEDIUM,
                title="Year-End Tax Planning",
                summary="December is the last month to make tax-saving moves for this year.",
                confidence=0.95,
                action_steps=[
                    "Maximize retirement contributions",
                    "Prepay deductible expenses",
                    "Review estimated tax payments",
                    "Gather receipts for deductions",
                ],
            ))

        if today.month == 1 and today.day <= 31:
            insights.append(Insight(
                insight_type=InsightType.COMPLIANCE,
                priority=InsightPriority.HIGH,
                title="1099 Filing Deadline Approaching",
                summary="1099-NEC forms must be filed by January 31 for contractors paid $600+.",
                confidence=0.95,
                action_steps=[
                    "Identify contractors paid $600 or more",
                    "Collect W-9 forms if missing",
                    "File 1099-NEC forms",
                ],
                deadline=date(today.year, 1, 31),
            ))

        return insights

    def _get_quarter(self) -> int:
        return (date.today().month - 1) // 3 + 1


class RealTimeInsightGenerator:
    def __init__(self, engine: AIEngine, db=None):
        self.engine = engine
        self.db = db
        self.insight_engine = InsightEngine(engine, db)

    async def on_transaction_added(
        self,
        transaction,
        context: FinancialContext,
    ) -> List[Insight]:
        insights = []

        if transaction.amount < 0 and abs(transaction.amount) > context.income.average_monthly_income * 0.3:
            tax_reserve = abs(transaction.amount) * 0.30
            insights.append(Insight(
                insight_type=InsightType.TAX_SAVING,
                priority=InsightPriority.MEDIUM,
                title="Income Received - Tax Reserve Reminder",
                summary=f"You received ${abs(transaction.amount):,.2f}. Consider setting aside ${tax_reserve:,.2f} for taxes.",
                detailed_explanation=f"""Income received: ${abs(transaction.amount):,.2f}

Recommended tax reserve (30%): ${tax_reserve:,.2f}

This covers:
- Federal income tax (~22% marginal)
- Illinois state tax (4.95%)
- Self-employment tax (15.3% × 92.35% = ~14.1%)

Transfer to your tax savings account to avoid surprises at tax time.""",
                potential_impact=tax_reserve,
                confidence=0.95,
                action_steps=[
                    f"Transfer ${tax_reserve:,.2f} to tax savings account",
                    "Verify client/source for records",
                    "Update income tracking",
                ],
                related_transactions=[str(transaction.id)],
            ))

        return insights

    async def on_invoice_overdue(
        self,
        invoice,
        context: FinancialContext,
    ) -> List[Insight]:
        insights = []

        days_overdue = invoice.days_overdue

        if days_overdue == 1:
            tone = "friendly"
            priority = InsightPriority.LOW
        elif days_overdue <= 7:
            tone = "polite but firm"
            priority = InsightPriority.MEDIUM
        elif days_overdue <= 30:
            tone = "firm"
            priority = InsightPriority.HIGH
        else:
            tone = "final notice"
            priority = InsightPriority.CRITICAL

        insights.append(Insight(
            insight_type=InsightType.INVOICE_ALERT,
            priority=priority,
            title=f"Invoice #{invoice.invoice_number} is {days_overdue} Days Overdue",
            summary=f"Invoice to {invoice.client_name} for ${invoice.amount_due:,.2f} is now {days_overdue} days past due.",
            detailed_explanation=f"""Invoice Details:
- Invoice #: {invoice.invoice_number}
- Client: {invoice.client_name}
- Amount Due: ${invoice.amount_due:,.2f}
- Days Overdue: {days_overdue}

Recommended tone for follow-up: {tone}""",
            potential_impact=invoice.amount_due,
            confidence=0.95,
            action_steps=[
                f"Send {tone} payment reminder",
                "Call client if no response in 2 days",
                "Document all collection attempts",
            ],
            related_entities={"invoice_id": str(invoice.id), "client": invoice.client_name},
            requires_user_action=True,
        ))

        return insights

    async def on_balance_change(
        self,
        account_id: str,
        old_balance: float,
        new_balance: float,
        context: FinancialContext,
    ) -> List[Insight]:
        insights = []

        if new_balance < 1000 and old_balance >= 1000:
            insights.append(Insight(
                insight_type=InsightType.CASH_FLOW_WARNING,
                priority=InsightPriority.HIGH,
                title="Account Balance Below $1,000",
                summary=f"Your account balance has dropped to ${new_balance:,.2f}.",
                potential_impact=old_balance - new_balance,
                confidence=0.95,
                action_steps=[
                    "Review recent transactions",
                    "Transfer funds if available",
                    "Follow up on outstanding invoices",
                ],
                requires_user_action=True,
            ))

        if new_balance < 0:
            insights.append(Insight(
                insight_type=InsightType.CASH_FLOW_WARNING,
                priority=InsightPriority.CRITICAL,
                title="Account Overdrawn",
                summary=f"Your account balance is negative: ${new_balance:,.2f}",
                potential_impact=abs(new_balance) + 35,
                confidence=0.99,
                action_steps=[
                    "Transfer funds immediately",
                    "Contact bank about overdraft",
                    "Review pending transactions",
                ],
                requires_user_action=True,
            ))

        return insights

    async def generate_daily_digest(
        self,
        context: FinancialContext,
    ) -> Dict[str, Any]:
        insights = await self.insight_engine.generate_all_insights(context, max_insights=5)

        critical = [i for i in insights if i.priority == InsightPriority.CRITICAL]
        high = [i for i in insights if i.priority == InsightPriority.HIGH]

        return {
            "date": date.today().isoformat(),
            "health_score": context.health_score,
            "summary": f"You have {len(critical)} critical and {len(high)} high priority items to address.",
            "critical_items": len(critical),
            "high_priority_items": len(high),
            "insights": [i.to_dict() for i in insights],
            "quick_stats": {
                "balance": context.accounts.total_balance,
                "runway_months": context.cash_flow.current_runway_months,
                "outstanding_invoices": context.invoices.total_outstanding,
                "overdue_invoices": context.invoices.total_overdue,
                "tax_due_days": context.tax.days_until_deadline,
            }
        }