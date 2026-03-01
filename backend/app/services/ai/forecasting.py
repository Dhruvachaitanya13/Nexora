import asyncio
import json
import logging
import statistics
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import math

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.core.config import settings
from app.services.ai.engine import AIEngine, AIResponse, ResponseFormat
from app.services.ai.context import FinancialContext

logger = logging.getLogger(__name__)


class ForecastPeriod(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class ScenarioType(str, Enum):
    OPTIMISTIC = "optimistic"
    REALISTIC = "realistic"
    PESSIMISTIC = "pessimistic"


@dataclass
class ForecastPoint:
    period: str
    period_start: date
    period_end: date
    
    projected_income: float
    income_range: Tuple[float, float] = (0.0, 0.0)
    income_confidence: float = 0.7
    income_sources: Dict[str, float] = field(default_factory=dict)
    
    projected_expenses: float = 0.0
    expenses_range: Tuple[float, float] = (0.0, 0.0)
    expenses_confidence: float = 0.8
    expenses_by_category: Dict[str, float] = field(default_factory=dict)
    
    net_cash_flow: float = 0.0
    ending_balance: float = 0.0
    
    tax_liability: float = 0.0
    tax_payment_due: float = 0.0
    
    key_assumptions: List[str] = field(default_factory=list)
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    
    confidence: float = 0.7
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "period": self.period,
            "period_start": str(self.period_start),
            "period_end": str(self.period_end),
            "projected_income": self.projected_income,
            "income_range": list(self.income_range),
            "projected_expenses": self.projected_expenses,
            "expenses_range": list(self.expenses_range),
            "net_cash_flow": self.net_cash_flow,
            "ending_balance": self.ending_balance,
            "tax_liability": self.tax_liability,
            "confidence": self.confidence,
            "key_assumptions": self.key_assumptions,
        }


@dataclass
class Scenario:
    scenario_type: ScenarioType
    description: str
    forecasts: List[ForecastPoint]
    final_balance: float
    total_income: float
    total_expenses: float
    assumptions: List[str]
    probability: float = 0.33
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.scenario_type.value,
            "description": self.description,
            "forecasts": [f.to_dict() for f in self.forecasts],
            "final_balance": self.final_balance,
            "total_income": self.total_income,
            "total_expenses": self.total_expenses,
            "assumptions": self.assumptions,
            "probability": self.probability,
        }


@dataclass
class CashFlowForecast:
    generated_at: datetime
    starting_balance: float
    forecast_period: ForecastPeriod
    num_periods: int
    
    realistic: Scenario
    optimistic: Optional[Scenario] = None
    pessimistic: Optional[Scenario] = None
    
    runway_months: float = 0.0
    cash_crunch_risk: bool = False
    cash_crunch_date: Optional[date] = None
    
    risk_factors: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[Dict[str, Any]] = field(default_factory=list)
    
    model_version: str = "2.0"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "generated_at": self.generated_at.isoformat(),
            "starting_balance": self.starting_balance,
            "forecast_period": self.forecast_period.value,
            "num_periods": self.num_periods,
            "realistic": self.realistic.to_dict(),
            "optimistic": self.optimistic.to_dict() if self.optimistic else None,
            "pessimistic": self.pessimistic.to_dict() if self.pessimistic else None,
            "runway_months": self.runway_months,
            "cash_crunch_risk": self.cash_crunch_risk,
            "cash_crunch_date": str(self.cash_crunch_date) if self.cash_crunch_date else None,
            "risk_factors": self.risk_factors,
            "recommendations": self.recommendations,
        }


class IncomePredictor:
    def __init__(self, context: FinancialContext):
        self.context = context
        self.monthly_history = self._extract_monthly_income()
    
    def _extract_monthly_income(self) -> Dict[str, float]:
        result = {}
        for item in self.context.income.monthly_trend:
            result[item["month"]] = item["amount"]
        return result
    
    def predict(
        self,
        target_month: str,
        scenario: ScenarioType = ScenarioType.REALISTIC,
    ) -> Tuple[float, Tuple[float, float], float]:
        if not self.monthly_history:
            base = self.context.income.average_monthly_income or 5000
            return base, (base * 0.7, base * 1.3), 0.5
        
        values = list(self.monthly_history.values())
        
        if len(values) >= 3:
            mean = statistics.mean(values)
            std = statistics.stdev(values) if len(values) > 1 else mean * 0.2
        else:
            mean = statistics.mean(values) if values else 5000
            std = mean * 0.25
        
        cv = (std / mean) * 100 if mean > 0 else 50
        
        if cv < 15:
            confidence = 0.85
        elif cv < 30:
            confidence = 0.70
        elif cv < 50:
            confidence = 0.55
        else:
            confidence = 0.40
        
        if len(values) >= 3:
            recent_trend = values[-1] - values[-3] if len(values) >= 3 else 0
            trend_adjustment = recent_trend / 3
        else:
            trend_adjustment = 0
        
        if scenario == ScenarioType.OPTIMISTIC:
            prediction = mean + std * 0.5 + trend_adjustment
            range_low = mean
            range_high = mean + std * 1.5
        elif scenario == ScenarioType.PESSIMISTIC:
            prediction = mean - std * 0.5 + trend_adjustment
            range_low = mean - std * 1.5
            range_high = mean
        else:
            prediction = mean + trend_adjustment
            range_low = mean - std
            range_high = mean + std
        
        prediction = max(0, prediction)
        range_low = max(0, range_low)
        range_high = max(range_low, range_high)
        
        return prediction, (range_low, range_high), confidence
    
    def predict_multiple(
        self,
        num_months: int,
        scenario: ScenarioType = ScenarioType.REALISTIC,
    ) -> List[Tuple[float, Tuple[float, float], float]]:
        predictions = []
        base_month = date.today().replace(day=1)
        
        for i in range(num_months):
            target = base_month + timedelta(days=32 * i)
            target_month = target.strftime("%Y-%m")
            prediction = self.predict(target_month, scenario)
            
            decay = 0.95 ** i
            adjusted_confidence = prediction[2] * decay
            predictions.append((prediction[0], prediction[1], adjusted_confidence))
        
        return predictions


class ExpensePredictor:
    def __init__(self, context: FinancialContext):
        self.context = context
        self.monthly_history = self._extract_monthly_expenses()
        self.recurring = context.expenses.recurring_expenses
    
    def _extract_monthly_expenses(self) -> Dict[str, float]:
        result = {}
        for item in self.context.expenses.monthly_trend:
            result[item["month"]] = item["amount"]
        return result
    
    def predict(
        self,
        target_month: str,
        scenario: ScenarioType = ScenarioType.REALISTIC,
    ) -> Tuple[float, Tuple[float, float], float]:
        if not self.monthly_history:
            base = self.context.expenses.average_monthly_expenses or 3000
            return base, (base * 0.8, base * 1.2), 0.6
        
        values = list(self.monthly_history.values())
        mean = statistics.mean(values)
        std = statistics.stdev(values) if len(values) > 1 else mean * 0.15
        
        base_recurring = self.recurring
        base_variable = mean - base_recurring
        
        confidence = 0.80
        
        if scenario == ScenarioType.OPTIMISTIC:
            prediction = base_recurring + base_variable * 0.85
            range_low = base_recurring + base_variable * 0.7
            range_high = mean
        elif scenario == ScenarioType.PESSIMISTIC:
            prediction = base_recurring + base_variable * 1.2
            range_low = mean
            range_high = base_recurring + base_variable * 1.5
        else:
            prediction = mean
            range_low = mean - std * 0.5
            range_high = mean + std * 0.5
        
        prediction = max(0, prediction)
        range_low = max(0, range_low)
        range_high = max(range_low, range_high)
        
        return prediction, (range_low, range_high), confidence
    
    def predict_multiple(
        self,
        num_months: int,
        scenario: ScenarioType = ScenarioType.REALISTIC,
    ) -> List[Tuple[float, Tuple[float, float], float]]:
        predictions = []
        base_month = date.today().replace(day=1)
        
        for i in range(num_months):
            target = base_month + timedelta(days=32 * i)
            target_month = target.strftime("%Y-%m")
            predictions.append(self.predict(target_month, scenario))
        
        return predictions


class CashFlowForecaster:
    def __init__(self, engine: AIEngine, db: Session = None):
        self.engine = engine
        self.db = db
    
    async def generate_forecast(
        self,
        context: FinancialContext,
        num_months: int = 3,
        include_scenarios: bool = True,
    ) -> CashFlowForecast:
        income_predictor = IncomePredictor(context)
        expense_predictor = ExpensePredictor(context)
        
        realistic_forecasts = self._generate_scenario_forecasts(
            context, income_predictor, expense_predictor, num_months, ScenarioType.REALISTIC
        )
        
        realistic = Scenario(
            scenario_type=ScenarioType.REALISTIC,
            description="Most likely outcome based on historical patterns",
            forecasts=realistic_forecasts,
            final_balance=realistic_forecasts[-1].ending_balance if realistic_forecasts else context.accounts.total_balance,
            total_income=sum(f.projected_income for f in realistic_forecasts),
            total_expenses=sum(f.projected_expenses for f in realistic_forecasts),
            assumptions=["Income continues at historical average", "Expenses remain stable", "No major unexpected events"],
            probability=0.50,
        )
        
        optimistic = None
        pessimistic = None
        
        if include_scenarios:
            opt_forecasts = self._generate_scenario_forecasts(
                context, income_predictor, expense_predictor, num_months, ScenarioType.OPTIMISTIC
            )
            optimistic = Scenario(
                scenario_type=ScenarioType.OPTIMISTIC,
                description="Best case with higher income and controlled expenses",
                forecasts=opt_forecasts,
                final_balance=opt_forecasts[-1].ending_balance if opt_forecasts else context.accounts.total_balance,
                total_income=sum(f.projected_income for f in opt_forecasts),
                total_expenses=sum(f.projected_expenses for f in opt_forecasts),
                assumptions=["Income growth continues", "New clients acquired", "Expenses well controlled"],
                probability=0.25,
            )
            
            pess_forecasts = self._generate_scenario_forecasts(
                context, income_predictor, expense_predictor, num_months, ScenarioType.PESSIMISTIC
            )
            pessimistic = Scenario(
                scenario_type=ScenarioType.PESSIMISTIC,
                description="Challenging scenario with reduced income",
                forecasts=pess_forecasts,
                final_balance=pess_forecasts[-1].ending_balance if pess_forecasts else context.accounts.total_balance,
                total_income=sum(f.projected_income for f in pess_forecasts),
                total_expenses=sum(f.projected_expenses for f in pess_forecasts),
                assumptions=["Income declines", "Client loss or reduced work", "Unexpected expenses"],
                probability=0.25,
            )
        
        runway = self._calculate_runway(context, realistic_forecasts)
        cash_crunch_risk, cash_crunch_date = self._check_cash_crunch(realistic_forecasts)
        
        risk_factors = self._identify_risk_factors(context, realistic_forecasts)
        recommendations = await self._generate_recommendations(context, realistic, risk_factors)
        
        return CashFlowForecast(
            generated_at=datetime.utcnow(),
            starting_balance=context.accounts.total_balance,
            forecast_period=ForecastPeriod.MONTHLY,
            num_periods=num_months,
            realistic=realistic,
            optimistic=optimistic,
            pessimistic=pessimistic,
            runway_months=runway,
            cash_crunch_risk=cash_crunch_risk,
            cash_crunch_date=cash_crunch_date,
            risk_factors=risk_factors,
            recommendations=recommendations,
        )
    
    def _generate_scenario_forecasts(
        self,
        context: FinancialContext,
        income_predictor: IncomePredictor,
        expense_predictor: ExpensePredictor,
        num_months: int,
        scenario: ScenarioType,
    ) -> List[ForecastPoint]:
        forecasts = []
        current_balance = context.accounts.total_balance
        base_date = date.today().replace(day=1)
        
        income_predictions = income_predictor.predict_multiple(num_months, scenario)
        expense_predictions = expense_predictor.predict_multiple(num_months, scenario)
        
        for i in range(num_months):
            period_start = base_date + timedelta(days=32 * i)
            period_start = period_start.replace(day=1)
            
            if period_start.month == 12:
                period_end = period_start.replace(year=period_start.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                period_end = period_start.replace(month=period_start.month + 1, day=1) - timedelta(days=1)
            
            income, income_range, income_conf = income_predictions[i]
            expenses, expenses_range, expenses_conf = expense_predictions[i]
            
            tax_payment = self._get_tax_payment_for_month(context, period_start)
            total_expenses = expenses + tax_payment
            
            net_cash_flow = income - total_expenses
            ending_balance = current_balance + net_cash_flow
            
            combined_confidence = (income_conf * 0.6 + expenses_conf * 0.4) * (0.95 ** i)
            
            forecast = ForecastPoint(
                period=period_start.strftime("%Y-%m"),
                period_start=period_start,
                period_end=period_end,
                projected_income=income,
                income_range=income_range,
                income_confidence=income_conf,
                projected_expenses=total_expenses,
                expenses_range=(expenses_range[0] + tax_payment, expenses_range[1] + tax_payment),
                expenses_confidence=expenses_conf,
                net_cash_flow=net_cash_flow,
                ending_balance=ending_balance,
                tax_liability=context.tax.estimated_annual_tax / 12,
                tax_payment_due=tax_payment,
                confidence=combined_confidence,
                key_assumptions=[
                    f"Income based on {context.income.income_variability.value} variability pattern",
                    f"Expenses include ${context.expenses.recurring_expenses:,.0f} recurring",
                ],
            )
            
            forecasts.append(forecast)
            current_balance = ending_balance
        
        return forecasts
    
    def _get_tax_payment_for_month(self, context: FinancialContext, month: date) -> float:
        tax_months = {4: "Q1", 6: "Q2", 9: "Q3", 1: "Q4"}
        
        if month.month in tax_months:
            return context.tax.quarterly_payment_due
        return 0.0
    
    def _calculate_runway(
        self,
        context: FinancialContext,
        forecasts: List[ForecastPoint],
    ) -> float:
        if not forecasts:
            if context.cash_flow.burn_rate > 0:
                return context.accounts.total_balance / context.cash_flow.burn_rate
            return 12.0
        
        current_balance = context.accounts.total_balance
        months = 0
        
        for forecast in forecasts:
            if forecast.ending_balance < 0:
                if forecast.net_cash_flow < 0:
                    months += current_balance / abs(forecast.net_cash_flow)
                break
            current_balance = forecast.ending_balance
            months += 1
        else:
            avg_net = sum(f.net_cash_flow for f in forecasts) / len(forecasts)
            if avg_net < 0:
                remaining = current_balance / abs(avg_net)
                months += remaining
            else:
                months = 12.0
        
        return months
    
    def _check_cash_crunch(
        self,
        forecasts: List[ForecastPoint],
    ) -> Tuple[bool, Optional[date]]:
        for forecast in forecasts:
            if forecast.ending_balance < 0:
                return True, forecast.period_start
            if forecast.ending_balance < 1000:
                return True, forecast.period_start
        
        return False, None
    
    def _identify_risk_factors(
        self,
        context: FinancialContext,
        forecasts: List[ForecastPoint],
    ) -> List[Dict[str, Any]]:
        risks = []
        
        if context.income.income_variability.value in ["high", "very_high"]:
            risks.append({
                "factor": "High Income Variability",
                "description": f"Your income variability coefficient is {context.income.variability_coefficient:.1f}%",
                "impact": "Forecast accuracy is lower; actual results may differ significantly",
                "probability": "medium",
                "mitigation": "Build larger cash reserves; diversify income sources",
            })
        
        if context.invoices.total_overdue > context.income.average_monthly_income * 0.5:
            risks.append({
                "factor": "Significant Overdue Invoices",
                "description": f"${context.invoices.total_overdue:,.2f} in overdue invoices",
                "impact": "Projected income may not materialize",
                "probability": "medium",
                "mitigation": "Aggressive follow-up on overdue invoices",
            })
        
        if forecasts:
            min_balance = min(f.ending_balance for f in forecasts)
            if min_balance < context.cash_flow.burn_rate:
                risks.append({
                    "factor": "Low Cash Buffer Projected",
                    "description": f"Minimum projected balance: ${min_balance:,.2f}",
                    "impact": "Risk of overdraft or inability to cover expenses",
                    "probability": "high" if min_balance < 0 else "medium",
                    "mitigation": "Reduce expenses or accelerate income collection",
                })
        
        if context.tax.days_until_deadline and context.tax.days_until_deadline <= 45:
            risks.append({
                "factor": "Upcoming Tax Payment",
                "description": f"${context.tax.quarterly_payment_due:,.2f} due in {context.tax.days_until_deadline} days",
                "impact": "Significant cash outflow required",
                "probability": "high",
                "mitigation": "Ensure tax reserve is adequately funded",
            })
        
        return risks
    
    async def _generate_recommendations(
        self,
        context: FinancialContext,
        scenario: Scenario,
        risks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        recommendations = []
        
        if scenario.final_balance < context.accounts.total_balance * 0.5:
            recommendations.append({
                "title": "Improve Cash Position",
                "description": "Your projected balance declines significantly. Take action to improve cash flow.",
                "priority": "high",
                "actions": [
                    "Follow up on outstanding invoices",
                    "Review and reduce discretionary expenses",
                    "Consider offering discounts for early payment",
                ],
            })
        
        for risk in risks:
            if risk["probability"] == "high":
                recommendations.append({
                    "title": f"Address: {risk['factor']}",
                    "description": risk["description"],
                    "priority": "high",
                    "actions": [risk["mitigation"]],
                })
        
        if context.cash_flow.current_runway_months < 3:
            recommendations.append({
                "title": "Build Emergency Fund",
                "description": f"Current runway is {context.cash_flow.current_runway_months:.1f} months. Target 3-6 months.",
                "priority": "medium",
                "actions": [
                    "Set aside 10-20% of each payment received",
                    "Open separate high-yield savings account",
                    "Automate monthly transfers",
                ],
            })
        
        return recommendations
    
    async def what_if_analysis(
        self,
        context: FinancialContext,
        scenario: Dict[str, Any],
    ) -> Dict[str, Any]:
        response = await self.engine.what_if_analysis(context, scenario)
        
        if response.success:
            try:
                return json.loads(response.content)
            except json.JSONDecodeError:
                return {"content": response.content}
        
        return {"error": response.error or "Analysis failed"}
