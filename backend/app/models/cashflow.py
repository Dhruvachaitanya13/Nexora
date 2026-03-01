from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
import uuid
import enum
import statistics

from app.db.base import Base


class ForecastPeriod(str, enum.Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class ForecastConfidence(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    VERY_LOW = "very_low"


class AlertSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    URGENT = "urgent"


class AlertType(str, enum.Enum):
    LOW_BALANCE = "low_balance"
    NEGATIVE_BALANCE = "negative_balance"
    CASH_CRUNCH = "cash_crunch"
    UNUSUAL_EXPENSE = "unusual_expense"
    MISSED_INCOME = "missed_income"
    TAX_DEADLINE = "tax_deadline"
    INVOICE_OVERDUE = "invoice_overdue"
    PAYMENT_DUE = "payment_due"
    SPENDING_SPIKE = "spending_spike"
    INCOME_DROP = "income_drop"
    SUBSCRIPTION_INCREASE = "subscription_increase"
    GOAL_AT_RISK = "goal_at_risk"
    OPPORTUNITY = "opportunity"


class CashFlowForecast(Base):
    __tablename__ = "cash_flow_forecasts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    forecast_date = Column(Date, nullable=False)
    period = Column(Enum(ForecastPeriod), default=ForecastPeriod.MONTHLY, nullable=False)
    
    generated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    model_version = Column(String(20), default="v2.0")
    model_type = Column(String(50), default="ensemble")
    
    starting_balance = Column(Float, nullable=False)
    
    projected_income = Column(Float, default=0.0, nullable=False)
    projected_income_min = Column(Float, nullable=True)
    projected_income_max = Column(Float, nullable=True)
    income_confidence = Column(Float, nullable=True)
    income_sources_breakdown = Column(JSONB, default=dict)
    
    projected_expenses = Column(Float, default=0.0, nullable=False)
    projected_expenses_min = Column(Float, nullable=True)
    projected_expenses_max = Column(Float, nullable=True)
    expenses_confidence = Column(Float, nullable=True)
    expenses_breakdown = Column(JSONB, default=dict)
    
    projected_recurring_income = Column(Float, default=0.0)
    projected_recurring_expenses = Column(Float, default=0.0)
    projected_variable_income = Column(Float, default=0.0)
    projected_variable_expenses = Column(Float, default=0.0)
    
    projected_tax_liability = Column(Float, default=0.0)
    projected_tax_reserve_needed = Column(Float, default=0.0)
    
    ending_balance = Column(Float, nullable=False)
    ending_balance_min = Column(Float, nullable=True)
    ending_balance_max = Column(Float, nullable=True)
    
    net_cash_flow = Column(Float, nullable=False)
    
    confidence_level = Column(Enum(ForecastConfidence), default=ForecastConfidence.MEDIUM)
    confidence_score = Column(Float, nullable=True)
    confidence_factors = Column(JSONB, default=dict)
    
    risk_score = Column(Float, default=0.0)
    risk_factors = Column(JSONB, default=list)
    
    days_until_negative = Column(Integer, nullable=True)
    runway_months = Column(Float, nullable=True)
    
    scenario_type = Column(String(50), default="realistic")
    
    assumptions = Column(JSONB, default=dict)
    data_points_used = Column(Integer, default=0)
    historical_accuracy = Column(Float, nullable=True)
    
    recommendations = Column(JSONB, default=list)
    alerts = Column(JSONB, default=list)
    
    is_active = Column(Boolean, default=True)
    was_accurate = Column(Boolean, nullable=True)
    actual_ending_balance = Column(Float, nullable=True)
    accuracy_score = Column(Float, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_cashflow_forecasts_user_date", "user_id", "forecast_date"),
        Index("ix_cashflow_forecasts_user_period", "user_id", "period"),
        UniqueConstraint("user_id", "forecast_date", "period", "scenario_type", name="uq_user_forecast"),
    )
    
    @hybrid_property
    def is_negative_projected(self) -> bool:
        return self.ending_balance < 0
    
    @hybrid_property
    def is_high_risk(self) -> bool:
        return self.risk_score >= 70 or self.is_negative_projected
    
    @hybrid_property
    def cash_flow_health(self) -> str:
        if self.ending_balance < 0:
            return "critical"
        if self.net_cash_flow < 0 and self.ending_balance < self.starting_balance * 0.5:
            return "warning"
        if self.net_cash_flow >= 0:
            return "healthy"
        return "moderate"
    
    @hybrid_property
    def savings_rate(self) -> float:
        if self.projected_income <= 0:
            return 0.0
        return max(0, (self.net_cash_flow / self.projected_income) * 100)
    
    def calculate_runway(self, monthly_burn: float = None) -> float:
        if not monthly_burn:
            monthly_burn = self.projected_expenses - self.projected_income
            if monthly_burn <= 0:
                return float('inf')
        if monthly_burn <= 0:
            return float('inf')
        return self.ending_balance / monthly_burn
    
    def add_risk_factor(self, factor: str, score: float, description: str = None) -> None:
        if not self.risk_factors:
            self.risk_factors = []
        self.risk_factors.append({
            "factor": factor,
            "score": score,
            "description": description,
            "timestamp": datetime.utcnow().isoformat(),
        })
        self._recalculate_risk_score()
    
    def _recalculate_risk_score(self) -> None:
        if not self.risk_factors:
            self.risk_score = 0
            return
        scores = [f.get("score", 0) for f in self.risk_factors]
        self.risk_score = min(100, sum(scores) / len(scores) * 1.5)
    
    def add_recommendation(self, title: str, description: str, priority: str = "medium", action: str = None) -> None:
        if not self.recommendations:
            self.recommendations = []
        self.recommendations.append({
            "title": title,
            "description": description,
            "priority": priority,
            "action": action,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def add_alert(self, alert_type: AlertType, severity: AlertSeverity, message: str, data: Dict = None) -> None:
        if not self.alerts:
            self.alerts = []
        self.alerts.append({
            "type": alert_type.value,
            "severity": severity.value,
            "message": message,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def evaluate_accuracy(self, actual_balance: float) -> None:
        self.actual_ending_balance = actual_balance
        variance = abs(actual_balance - self.ending_balance)
        max_variance = max(abs(self.ending_balance), abs(actual_balance), 1)
        self.accuracy_score = max(0, 100 - (variance / max_variance * 100))
        self.was_accurate = self.accuracy_score >= 80
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "forecast_date": str(self.forecast_date),
            "period": self.period.value if self.period else None,
            "starting_balance": self.starting_balance,
            "projected_income": self.projected_income,
            "projected_expenses": self.projected_expenses,
            "ending_balance": self.ending_balance,
            "net_cash_flow": self.net_cash_flow,
            "confidence": self.confidence_level.value if self.confidence_level else None,
            "confidence_score": self.confidence_score,
            "risk_score": self.risk_score,
            "runway_months": self.runway_months,
            "days_until_negative": self.days_until_negative,
            "recommendations": self.recommendations,
            "alerts": self.alerts,
            "generated_at": self.generated_at.isoformat() if self.generated_at else None,
        }


class CashFlowActual(Base):
    __tablename__ = "cash_flow_actuals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    period_date = Column(Date, nullable=False)
    period = Column(Enum(ForecastPeriod), default=ForecastPeriod.MONTHLY, nullable=False)
    
    starting_balance = Column(Float, nullable=False)
    ending_balance = Column(Float, nullable=False)
    
    total_income = Column(Float, default=0.0, nullable=False)
    total_expenses = Column(Float, default=0.0, nullable=False)
    net_cash_flow = Column(Float, nullable=False)
    
    income_breakdown = Column(JSONB, default=dict)
    expense_breakdown = Column(JSONB, default=dict)
    
    recurring_income = Column(Float, default=0.0)
    recurring_expenses = Column(Float, default=0.0)
    variable_income = Column(Float, default=0.0)
    variable_expenses = Column(Float, default=0.0)
    
    transaction_count = Column(Integer, default=0)
    income_transactions = Column(Integer, default=0)
    expense_transactions = Column(Integer, default=0)
    
    largest_income = Column(Float, nullable=True)
    largest_expense = Column(Float, nullable=True)
    average_transaction = Column(Float, nullable=True)
    
    savings_rate = Column(Float, nullable=True)
    
    tax_paid = Column(Float, default=0.0)
    tax_reserved = Column(Float, default=0.0)
    
    forecast_id = Column(UUID(as_uuid=True), ForeignKey("cash_flow_forecasts.id", ondelete="SET NULL"), nullable=True)
    forecast_variance = Column(Float, nullable=True)
    forecast_accuracy = Column(Float, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_cashflow_actuals_user_date", "user_id", "period_date"),
        UniqueConstraint("user_id", "period_date", "period", name="uq_user_actual"),
    )
    
    def calculate_metrics(self) -> None:
        self.net_cash_flow = self.total_income - self.total_expenses
        if self.total_income > 0:
            self.savings_rate = (self.net_cash_flow / self.total_income) * 100
        if self.transaction_count > 0:
            self.average_transaction = (self.total_income + self.total_expenses) / self.transaction_count
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "period_date": str(self.period_date),
            "starting_balance": self.starting_balance,
            "ending_balance": self.ending_balance,
            "total_income": self.total_income,
            "total_expenses": self.total_expenses,
            "net_cash_flow": self.net_cash_flow,
            "savings_rate": self.savings_rate,
        }


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String(255), nullable=False)
    merchant_name = Column(String(255), nullable=True)
    merchant_name_pattern = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    amount = Column(Float, nullable=False)
    amount_variance = Column(Float, default=0.0)
    amount_min = Column(Float, nullable=True)
    amount_max = Column(Float, nullable=True)
    
    frequency = Column(String(20), nullable=False)
    frequency_days = Column(Integer, nullable=True)
    day_of_month = Column(Integer, nullable=True)
    day_of_week = Column(Integer, nullable=True)
    
    is_income = Column(Boolean, default=False, nullable=False)
    is_expense = Column(Boolean, default=True, nullable=False)
    is_subscription = Column(Boolean, default=False)
    is_bill = Column(Boolean, default=False)
    is_essential = Column(Boolean, default=False)
    
    category = Column(String(100), nullable=True)
    schedule_c_category = Column(String(100), nullable=True)
    is_business_expense = Column(Boolean, default=False)
    is_tax_deductible = Column(Boolean, default=False)
    
    first_occurrence = Column(Date, nullable=True)
    last_occurrence = Column(Date, nullable=True)
    next_expected_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    
    occurrence_count = Column(Integer, default=0)
    missed_count = Column(Integer, default=0)
    
    confidence_score = Column(Float, default=0.0)
    detection_method = Column(String(50), default="pattern")
    
    annual_total = Column(Float, nullable=True)
    monthly_average = Column(Float, nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_confirmed = Column(Boolean, default=False)
    is_auto_detected = Column(Boolean, default=True)
    
    alert_before_days = Column(Integer, default=3)
    alert_enabled = Column(Boolean, default=True)
    
    linked_transactions = Column(ARRAY(UUID(as_uuid=True)), default=list)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_recurring_user_active", "user_id", "is_active"),
        Index("ix_recurring_next_date", "next_expected_date"),
        Index("ix_recurring_merchant", "merchant_name"),
    )
    
    @hybrid_property
    def annual_cost(self) -> float:
        if self.annual_total:
            return self.annual_total
        
        frequency_multipliers = {
            "daily": 365,
            "weekly": 52,
            "biweekly": 26,
            "monthly": 12,
            "quarterly": 4,
            "semi_annual": 2,
            "annual": 1,
        }
        multiplier = frequency_multipliers.get(self.frequency, 12)
        return abs(self.amount) * multiplier
    
    @hybrid_property
    def monthly_cost(self) -> float:
        return self.annual_cost / 12
    
    @hybrid_property
    def is_due_soon(self) -> bool:
        if not self.next_expected_date:
            return False
        days_until = (self.next_expected_date - date.today()).days
        return 0 <= days_until <= self.alert_before_days
    
    @hybrid_property
    def is_overdue(self) -> bool:
        if not self.next_expected_date:
            return False
        return self.next_expected_date < date.today()
    
    def calculate_next_occurrence(self) -> None:
        if not self.last_occurrence:
            return
        
        days_map = {
            "daily": 1,
            "weekly": 7,
            "biweekly": 14,
            "monthly": 30,
            "quarterly": 90,
            "semi_annual": 180,
            "annual": 365,
        }
        
        days = self.frequency_days or days_map.get(self.frequency, 30)
        self.next_expected_date = self.last_occurrence + timedelta(days=days)
    
    def record_occurrence(self, transaction_date: date, amount: float, transaction_id: uuid.UUID = None) -> None:
        self.last_occurrence = transaction_date
        self.occurrence_count += 1
        
        if self.amount_min is None or amount < self.amount_min:
            self.amount_min = amount
        if self.amount_max is None or amount > self.amount_max:
            self.amount_max = amount
        
        self.amount_variance = (self.amount_max - self.amount_min) / max(abs(self.amount), 1) * 100
        
        if transaction_id and self.linked_transactions:
            self.linked_transactions.append(transaction_id)
        
        self.calculate_next_occurrence()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "merchant": self.merchant_name,
            "amount": self.amount,
            "frequency": self.frequency,
            "is_income": self.is_income,
            "category": self.category,
            "next_date": str(self.next_expected_date) if self.next_expected_date else None,
            "annual_cost": self.annual_cost,
            "monthly_cost": self.monthly_cost,
            "is_subscription": self.is_subscription,
            "is_essential": self.is_essential,
            "confidence": self.confidence_score,
        }


class CashFlowAlert(Base):
    __tablename__ = "cash_flow_alerts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    alert_type = Column(Enum(AlertType), nullable=False)
    severity = Column(Enum(AlertSeverity), default=AlertSeverity.INFO, nullable=False)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    details = Column(JSONB, default=dict)
    
    amount = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    
    related_entity_type = Column(String(50), nullable=True)
    related_entity_id = Column(UUID(as_uuid=True), nullable=True)
    
    action_url = Column(String(500), nullable=True)
    action_text = Column(String(100), nullable=True)
    
    is_read = Column(Boolean, default=False, nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    is_actioned = Column(Boolean, default=False, nullable=False)
    
    read_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    actioned_at = Column(DateTime(timezone=True), nullable=True)
    
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime(timezone=True), nullable=True)
    notification_channels = Column(ARRAY(String), default=list)
    
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_alerts_user_unread", "user_id", "is_read", "is_dismissed"),
        Index("ix_alerts_user_type", "user_id", "alert_type"),
        Index("ix_alerts_severity", "severity"),
    )
    
    def mark_read(self) -> None:
        self.is_read = True
        self.read_at = datetime.utcnow()
    
    def dismiss(self) -> None:
        self.is_dismissed = True
        self.dismissed_at = datetime.utcnow()
    
    def mark_actioned(self) -> None:
        self.is_actioned = True
        self.actioned_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "type": self.alert_type.value if self.alert_type else None,
            "severity": self.severity.value if self.severity else None,
            "title": self.title,
            "message": self.message,
            "amount": self.amount,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
