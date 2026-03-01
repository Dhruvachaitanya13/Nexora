from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base


class GoalType(str, enum.Enum):
    SAVINGS = "savings"
    EMERGENCY_FUND = "emergency_fund"
    TAX_RESERVE = "tax_reserve"
    DEBT_PAYOFF = "debt_payoff"
    RETIREMENT = "retirement"
    INCOME = "income"
    EXPENSE_REDUCTION = "expense_reduction"
    INVESTMENT = "investment"
    CUSTOM = "custom"


class GoalStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    ON_TRACK = "on_track"
    BEHIND = "behind"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class GoalPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Goal(Base):
    __tablename__ = "goals"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    goal_type = Column(Enum(GoalType), default=GoalType.SAVINGS, nullable=False)
    status = Column(Enum(GoalStatus), default=GoalStatus.NOT_STARTED, nullable=False)
    priority = Column(Enum(GoalPriority), default=GoalPriority.MEDIUM, nullable=False)
    
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0, nullable=False)
    starting_amount = Column(Float, default=0.0)
    
    currency = Column(String(3), default="USD")
    
    start_date = Column(Date, nullable=True)
    target_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)
    
    monthly_contribution_target = Column(Float, nullable=True)
    weekly_contribution_target = Column(Float, nullable=True)
    
    auto_contribute = Column(Boolean, default=False)
    auto_contribute_amount = Column(Float, nullable=True)
    auto_contribute_frequency = Column(String(20), nullable=True)
    auto_contribute_day = Column(Integer, nullable=True)
    
    linked_account_id = Column(UUID(as_uuid=True), nullable=True)
    
    reminder_enabled = Column(Boolean, default=True)
    reminder_frequency = Column(String(20), default="weekly")
    last_reminder_at = Column(DateTime(timezone=True), nullable=True)
    
    icon = Column(String(50), nullable=True)
    color = Column(String(10), nullable=True)
    image_url = Column(String(500), nullable=True)
    
    notes = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    milestones = Column(JSONB, default=list)
    
    user = relationship("User", back_populates="goals")
    contributions = relationship("GoalContribution", back_populates="goal", cascade="all, delete-orphan", lazy="selectin")
    
    __table_args__ = (
        Index("ix_goals_user_status", "user_id", "status"),
        Index("ix_goals_user_type", "user_id", "goal_type"),
        Index("ix_goals_target_date", "target_date"),
    )
    
    @hybrid_property
    def progress_percentage(self) -> float:
        if self.target_amount <= 0:
            return 0.0
        return min(100.0, (self.current_amount / self.target_amount) * 100)
    
    @hybrid_property
    def amount_remaining(self) -> float:
        return max(0, self.target_amount - self.current_amount)
    
    @hybrid_property
    def is_completed(self) -> bool:
        return self.current_amount >= self.target_amount
    
    @hybrid_property
    def days_remaining(self) -> Optional[int]:
        if not self.target_date:
            return None
        delta = self.target_date - date.today()
        return max(0, delta.days)
    
    @hybrid_property
    def is_overdue(self) -> bool:
        if not self.target_date:
            return False
        return date.today() > self.target_date and not self.is_completed
    
    @hybrid_property
    def required_monthly_contribution(self) -> Optional[float]:
        if not self.target_date or self.is_completed:
            return None
        days = self.days_remaining
        if not days or days <= 0:
            return self.amount_remaining
        months = days / 30
        if months <= 0:
            return self.amount_remaining
        return self.amount_remaining / months
    
    def add_contribution(self, amount: float, note: str = None) -> "GoalContribution":
        contribution = GoalContribution(
            goal_id=self.id,
            amount=amount,
            note=note,
            balance_after=self.current_amount + amount,
        )
        self.current_amount += amount
        self.update_status()
        return contribution
    
    def update_status(self) -> None:
        if self.current_amount >= self.target_amount:
            self.status = GoalStatus.COMPLETED
            self.completed_date = date.today()
        elif self.current_amount > 0:
            if self.target_date:
                required = self.required_monthly_contribution
                actual = self.monthly_contribution_target or 0
                if required and actual >= required * 0.9:
                    self.status = GoalStatus.ON_TRACK
                else:
                    self.status = GoalStatus.BEHIND
            else:
                self.status = GoalStatus.IN_PROGRESS
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "type": self.goal_type.value if self.goal_type else None,
            "status": self.status.value if self.status else None,
            "target_amount": self.target_amount,
            "current_amount": self.current_amount,
            "progress": self.progress_percentage,
            "target_date": str(self.target_date) if self.target_date else None,
            "days_remaining": self.days_remaining,
        }


class GoalContribution(Base):
    __tablename__ = "goal_contributions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id", ondelete="CASCADE"), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="SET NULL"), nullable=True)
    
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=True)
    contribution_date = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    
    source = Column(String(50), default="manual")
    note = Column(Text, nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    goal = relationship("Goal", back_populates="contributions")
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "amount": self.amount,
            "date": self.contribution_date.isoformat() if self.contribution_date else None,
            "source": self.source,
        }
