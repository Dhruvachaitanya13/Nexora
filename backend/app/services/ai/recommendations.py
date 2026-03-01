import asyncio
import json
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.ai.engine import AIEngine, AIResponse, ResponseFormat
from app.services.ai.context import FinancialContext
from app.services.ai.insights import InsightEngine, Insight

logger = logging.getLogger(__name__)


class RecommendationCategory(str, Enum):
    TAX = "tax"
    SAVINGS = "savings"
    CASH_FLOW = "cash_flow"
    EXPENSE = "expense"
    INCOME = "income"
    COMPLIANCE = "compliance"
    GROWTH = "growth"


class RecommendationPriority(str, Enum):
    IMMEDIATE = "immediate"
    THIS_WEEK = "this_week"
    THIS_MONTH = "this_month"
    QUARTERLY = "quarterly"


@dataclass
class Recommendation:
    category: RecommendationCategory
    priority: RecommendationPriority
    title: str
    summary: str
    detailed_description: str = ""
    
    potential_impact: float = 0.0
    effort_level: str = "medium"
    time_to_complete: str = ""
    
    action_steps: List[str] = field(default_factory=list)
    resources: List[Dict[str, str]] = field(default_factory=list)
    
    deadline: Optional[date] = None
    recurring: bool = False
    
    confidence: float = 0.8
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "priority": self.priority.value,
            "title": self.title,
            "summary": self.summary,
            "detailed_description": self.detailed_description,
            "potential_impact": self.potential_impact,
            "effort_level": self.effort_level,
            "time_to_complete": self.time_to_complete,
            "action_steps": self.action_steps,
            "deadline": str(self.deadline) if self.deadline else None,
            "confidence": self.confidence,
        }


class RecommendationEngine:
    def __init__(self, engine: AIEngine, db: Session):
        self.engine = engine
        self.db = db
        self.insight_engine = InsightEngine(engine, db)
    
    async def generate_recommendations(
        self,
        context: FinancialContext,
        focus_areas: List[RecommendationCategory] = None,
        max_recommendations: int = 10,
    ) -> List[Recommendation]:
        recommendations = []
        
        recommendations.extend(self._generate_tax_recommendations(context))
        recommendations.extend(self._generate_cash_flow_recommendations(context))
        recommendations.extend(self._generate_savings_recommendations(context))
        recommendations.extend(self._generate_expense_recommendations(context))
        recommendations.extend(self._generate_income_recommendations(context))
        recommendations.extend(self._generate_compliance_recommendations(context))
        
        if focus_areas:
            recommendations = [r for r in recommendations if r.category in focus_areas]
        
        recommendations.sort(key=lambda r: (
            {"immediate": 0, "this_week": 1, "this_month": 2, "quarterly": 3}[r.priority.value],
            -r.potential_impact,
        ))
        
        return recommendations[:max_recommendations]
    
    def _generate_tax_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.tax.days_until_deadline and context.tax.days_until_deadline <= 14:
            recs.append(Recommendation(
                category=RecommendationCategory.TAX,
                priority=RecommendationPriority.IMMEDIATE,
                title="Pay Quarterly Estimated Taxes",
                summary=f"Quarterly payment of ${context.tax.quarterly_payment_due:,.2f} due in {context.tax.days_until_deadline} days",
                detailed_description=f"""Your Q{self._get_quarter()} estimated tax payment is due on {context.tax.next_deadline}.

Payment breakdown:
- Federal: ${context.tax.federal_tax / 4:,.2f}
- Illinois State: ${context.tax.state_tax / 4:,.2f}
- Self-Employment: ${context.tax.self_employment_tax / 4:,.2f}

Missing this payment may result in underpayment penalties.""",
                potential_impact=context.tax.quarterly_payment_due * 0.02,
                effort_level="low",
                time_to_complete="15 minutes",
                action_steps=[
                    "Log in to IRS Direct Pay or EFTPS",
                    f"Pay ${context.tax.federal_tax / 4:,.2f} for federal",
                    "Log in to MyTax Illinois",
                    f"Pay ${context.tax.state_tax / 4:,.2f} for state",
                    "Save confirmation numbers",
                ],
                deadline=context.tax.next_deadline,
            ))
        
        if context.tax.potential_deductions > 500:
            savings = context.tax.potential_deductions * 0.30
            recs.append(Recommendation(
                category=RecommendationCategory.TAX,
                priority=RecommendationPriority.THIS_WEEK,
                title="Claim Missing Business Deductions",
                summary=f"Potential ${savings:,.2f} in tax savings from uncategorized business expenses",
                potential_impact=savings,
                effort_level="medium",
                time_to_complete="30-60 minutes",
                action_steps=[
                    "Review uncategorized transactions",
                    "Identify business-related expenses",
                    "Assign Schedule C categories",
                    "Upload missing receipts",
                ],
            ))
        
        sep_ira_max = min(69000, context.income.ytd_income * 0.25)
        if sep_ira_max > 10000 and context.income.ytd_income > 75000:
            tax_savings = sep_ira_max * (context.tax.marginal_tax_rate / 100)
            recs.append(Recommendation(
                category=RecommendationCategory.TAX,
                priority=RecommendationPriority.THIS_MONTH,
                title="Maximize Retirement Contributions",
                summary=f"Contribute to SEP-IRA to save up to ${tax_savings:,.2f} in taxes",
                detailed_description=f"""As a self-employed individual, you can contribute up to ${sep_ira_max:,.2f} to a SEP-IRA for 2024.

Benefits:
- Reduces taxable income dollar-for-dollar
- Tax-deferred growth
- Deadline is your tax filing deadline

This is one of the most powerful tax reduction strategies for freelancers.""",
                potential_impact=tax_savings,
                effort_level="medium",
                time_to_complete="1-2 hours",
                action_steps=[
                    "Open SEP-IRA if you don't have one",
                    "Calculate your maximum contribution",
                    "Make contribution before deadline",
                    "Keep records for tax filing",
                ],
            ))
        
        return recs
    
    def _generate_cash_flow_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.cash_flow.current_runway_months < 2:
            recs.append(Recommendation(
                category=RecommendationCategory.CASH_FLOW,
                priority=RecommendationPriority.IMMEDIATE,
                title="Address Low Cash Runway",
                summary=f"Only {context.cash_flow.current_runway_months:.1f} months of expenses covered",
                potential_impact=context.cash_flow.burn_rate * 2,
                effort_level="high",
                action_steps=[
                    "Review and cut non-essential expenses",
                    "Follow up on all outstanding invoices",
                    "Reach out to clients for new work",
                    "Consider short-term financing if needed",
                ],
            ))
        
        if context.invoices.total_overdue > 0:
            recs.append(Recommendation(
                category=RecommendationCategory.CASH_FLOW,
                priority=RecommendationPriority.THIS_WEEK,
                title="Collect Overdue Invoices",
                summary=f"${context.invoices.total_overdue:,.2f} in overdue invoices to collect",
                potential_impact=context.invoices.total_overdue,
                effort_level="medium",
                action_steps=[
                    "Send reminder to all overdue clients",
                    "Call clients with invoices 30+ days overdue",
                    "Offer payment plans if needed",
                    "Document all collection attempts",
                ],
            ))
        
        return recs
    
    def _generate_savings_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.cash_flow.savings_rate < 15:
            target_savings = context.income.average_monthly_income * 0.20
            recs.append(Recommendation(
                category=RecommendationCategory.SAVINGS,
                priority=RecommendationPriority.THIS_MONTH,
                title="Increase Savings Rate",
                summary=f"Current savings rate is {context.cash_flow.savings_rate:.1f}%, target 20%",
                detailed_description=f"""Freelancers should aim for a 20% savings rate to build reserves for:
- Slow periods
- Tax payments
- Emergency expenses
- Business investments

Target monthly savings: ${target_savings:,.2f}""",
                potential_impact=target_savings * 12,
                effort_level="medium",
                action_steps=[
                    "Set up automatic transfers to savings",
                    "Review expenses for reduction opportunities",
                    "Consider raising rates for new clients",
                ],
            ))
        
        if context.cash_flow.current_runway_months < 6:
            target = context.cash_flow.burn_rate * 6
            current = context.accounts.total_balance
            needed = max(0, target - current)
            
            if needed > 1000:
                recs.append(Recommendation(
                    category=RecommendationCategory.SAVINGS,
                    priority=RecommendationPriority.THIS_MONTH,
                    title="Build 6-Month Emergency Fund",
                    summary=f"Need ${needed:,.2f} more to reach 6-month reserve",
                    potential_impact=needed,
                    effort_level="medium",
                    action_steps=[
                        "Open high-yield savings account",
                        f"Set monthly savings goal of ${needed/6:,.2f}",
                        "Automate monthly transfers",
                        "Track progress monthly",
                    ],
                ))
        
        return recs
    
    def _generate_expense_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.expenses.recurring_expenses > context.income.average_monthly_income * 0.3:
            potential_savings = context.expenses.recurring_expenses * 0.15
            recs.append(Recommendation(
                category=RecommendationCategory.EXPENSE,
                priority=RecommendationPriority.THIS_MONTH,
                title="Audit Recurring Expenses",
                summary=f"Recurring expenses are {(context.expenses.recurring_expenses / context.income.average_monthly_income * 100):.1f}% of income",
                potential_impact=potential_savings * 12,
                effort_level="low",
                time_to_complete="1 hour",
                action_steps=[
                    "List all subscriptions and recurring charges",
                    "Identify unused or underutilized services",
                    "Cancel or downgrade where possible",
                    "Negotiate better rates for essential services",
                ],
            ))
        
        return recs
    
    def _generate_income_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.income.income_variability.value in ["high", "very_high"]:
            recs.append(Recommendation(
                category=RecommendationCategory.INCOME,
                priority=RecommendationPriority.THIS_MONTH,
                title="Stabilize Income Streams",
                summary=f"High income variability ({context.income.variability_coefficient:.1f}%) creates planning challenges",
                effort_level="high",
                action_steps=[
                    "Pursue retainer-based client relationships",
                    "Diversify client base",
                    "Create recurring revenue products/services",
                    "Build larger cash reserves as buffer",
                ],
            ))
        
        return recs
    
    def _generate_compliance_recommendations(self, context: FinancialContext) -> List[Recommendation]:
        recs = []
        
        if context.data_quality.missing_receipts > 5:
            recs.append(Recommendation(
                category=RecommendationCategory.COMPLIANCE,
                priority=RecommendationPriority.THIS_WEEK,
                title="Upload Missing Receipts",
                summary=f"{context.data_quality.missing_receipts} business expenses need documentation",
                effort_level="low",
                time_to_complete="30 minutes",
                action_steps=[
                    "Review flagged transactions",
                    "Search email for digital receipts",
                    "Request duplicates from vendors",
                    "Upload photos of paper receipts",
                ],
            ))
        
        if context.data_quality.uncategorized_count > 20:
            recs.append(Recommendation(
                category=RecommendationCategory.COMPLIANCE,
                priority=RecommendationPriority.THIS_WEEK,
                title="Categorize Transactions",
                summary=f"{context.data_quality.uncategorized_count} transactions need categorization",
                effort_level="low",
                time_to_complete="20 minutes",
                action_steps=[
                    "Use AI auto-categorization feature",
                    "Review and confirm suggestions",
                    "Set up rules for recurring merchants",
                ],
            ))
        
        return recs
    
    def _get_quarter(self) -> int:
        return (date.today().month - 1) // 3 + 1


class ActionGenerator:
    def __init__(self, engine: AIEngine):
        self.engine = engine
    
    async def generate_action_plan(
        self,
        context: FinancialContext,
        goal: str,
        timeframe: str = "1 month",
    ) -> Dict[str, Any]:
        prompt = f"""Create a detailed action plan for this financial goal:

Goal: {goal}
Timeframe: {timeframe}

Current Financial Situation:
- Cash Balance: ${context.accounts.total_balance:,.2f}
- Monthly Income (avg): ${context.income.average_monthly_income:,.2f}
- Monthly Expenses (avg): ${context.expenses.average_monthly_expenses:,.2f}
- Savings Rate: {context.cash_flow.savings_rate:.1f}%
- Runway: {context.cash_flow.current_runway_months:.1f} months

Provide a JSON response with:
{{
    "goal_analysis": "Assessment of the goal's feasibility",
    "success_probability": 0.0-1.0,
    "milestones": [
        {{"week": 1, "milestone": "description", "actions": ["action1", "action2"]}}
    ],
    "potential_obstacles": ["obstacle1", "obstacle2"],
    "success_metrics": ["metric1", "metric2"],
    "resources_needed": ["resource1", "resource2"],
    "estimated_impact": {{
        "financial": "description",
        "time_investment": "X hours/week"
    }}
}}"""

        response = await self.engine.chat(
            messages=[{"role": "user", "content": prompt}],
            response_format=ResponseFormat.JSON,
            temperature=0.4,
        )
        
        if response.success:
            try:
                return json.loads(response.content)
            except json.JSONDecodeError:
                return {"error": "Failed to parse action plan", "content": response.content}
        
        return {"error": response.error or "Failed to generate action plan"}
