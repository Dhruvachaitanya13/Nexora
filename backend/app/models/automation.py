from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base


class AutomationType(str, enum.Enum):
    CATEGORIZATION = "categorization"
    TAX_ALERT = "tax_alert"
    CASH_FLOW_ALERT = "cash_flow_alert"
    INVOICE_REMINDER = "invoice_reminder"
    BILL_REMINDER = "bill_reminder"
    GOAL_CONTRIBUTION = "goal_contribution"
    REPORT_GENERATION = "report_generation"
    DATA_SYNC = "data_sync"
    INSIGHT_GENERATION = "insight_generation"
    BUDGET_ALERT = "budget_alert"
    RECURRING_DETECTION = "recurring_detection"
    ANOMALY_DETECTION = "anomaly_detection"
    CUSTOM = "custom"


class AutomationStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    ERROR = "error"


class TriggerType(str, enum.Enum):
    SCHEDULE = "schedule"
    EVENT = "event"
    THRESHOLD = "threshold"
    WEBHOOK = "webhook"
    MANUAL = "manual"


class Automation(Base):
    __tablename__ = "automations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    automation_type = Column(Enum(AutomationType), nullable=False)
    status = Column(Enum(AutomationStatus), default=AutomationStatus.ACTIVE, nullable=False)
    
    trigger_type = Column(Enum(TriggerType), default=TriggerType.EVENT, nullable=False)
    trigger_config = Column(JSONB, default=dict)
    
    conditions = Column(JSONB, default=list)
    actions = Column(JSONB, default=list)
    
    schedule_cron = Column(String(100), nullable=True)
    schedule_timezone = Column(String(50), default="America/Chicago")
    
    is_enabled = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False)
    
    run_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failure_count = Column(Integer, default=0)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_failure_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    
    cooldown_minutes = Column(Integer, default=0)
    max_runs_per_day = Column(Integer, nullable=True)
    runs_today = Column(Integer, default=0)
    
    notification_on_success = Column(Boolean, default=False)
    notification_on_failure = Column(Boolean, default=True)
    notification_channels = Column(ARRAY(String), default=["email"])
    
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="automations")
    rules = relationship("AutomationRule", back_populates="automation", cascade="all, delete-orphan", lazy="selectin")
    logs = relationship("AutomationLog", back_populates="automation", cascade="all, delete-orphan", lazy="selectin")
    
    __table_args__ = (
        Index("ix_automations_user_status", "user_id", "status"),
        Index("ix_automations_user_type", "user_id", "automation_type"),
        Index("ix_automations_next_run", "next_run_at"),
    )
    
    @hybrid_property
    def success_rate(self) -> float:
        if self.run_count == 0:
            return 0.0
        return (self.success_count / self.run_count) * 100
    
    @hybrid_property
    def is_runnable(self) -> bool:
        if not self.is_enabled or self.status != AutomationStatus.ACTIVE:
            return False
        if self.max_runs_per_day and self.runs_today >= self.max_runs_per_day:
            return False
        if self.cooldown_minutes and self.last_run_at:
            cooldown_end = self.last_run_at + timedelta(minutes=self.cooldown_minutes)
            if datetime.utcnow() < cooldown_end:
                return False
        return True
    
    def record_run(self, success: bool, error: str = None) -> None:
        self.run_count += 1
        self.runs_today += 1
        self.last_run_at = datetime.utcnow()
        
        if success:
            self.success_count += 1
            self.last_success_at = datetime.utcnow()
            self.last_error = None
        else:
            self.failure_count += 1
            self.last_failure_at = datetime.utcnow()
            self.last_error = error
    
    def pause(self) -> None:
        self.status = AutomationStatus.PAUSED
    
    def resume(self) -> None:
        self.status = AutomationStatus.ACTIVE
    
    def disable(self) -> None:
        self.status = AutomationStatus.DISABLED
        self.is_enabled = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "type": self.automation_type.value if self.automation_type else None,
            "status": self.status.value if self.status else None,
            "is_enabled": self.is_enabled,
            "run_count": self.run_count,
            "success_rate": self.success_rate,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
        }


class AutomationRule(Base):
    __tablename__ = "automation_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id = Column(UUID(as_uuid=True), ForeignKey("automations.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    
    rule_order = Column(Integer, default=0)
    
    condition_type = Column(String(50), nullable=False)
    condition_field = Column(String(100), nullable=True)
    condition_operator = Column(String(50), nullable=True)
    condition_value = Column(JSONB, nullable=True)
    
    action_type = Column(String(50), nullable=False)
    action_config = Column(JSONB, default=dict)
    
    is_enabled = Column(Boolean, default=True)
    
    match_count = Column(Integer, default=0)
    last_matched_at = Column(DateTime(timezone=True), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    automation = relationship("Automation", back_populates="rules")
    
    def record_match(self) -> None:
        self.match_count += 1
        self.last_matched_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "condition_type": self.condition_type,
            "action_type": self.action_type,
            "is_enabled": self.is_enabled,
            "match_count": self.match_count,
        }


class AutomationLog(Base):
    __tablename__ = "automation_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    automation_id = Column(UUID(as_uuid=True), ForeignKey("automations.id", ondelete="CASCADE"), nullable=False)
    
    run_id = Column(String(100), nullable=False)
    
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    
    trigger_type = Column(String(50), nullable=True)
    trigger_data = Column(JSONB, default=dict)
    
    status = Column(String(20), default="running")
    
    conditions_evaluated = Column(Integer, default=0)
    conditions_matched = Column(Integer, default=0)
    actions_executed = Column(Integer, default=0)
    actions_succeeded = Column(Integer, default=0)
    actions_failed = Column(Integer, default=0)
    
    input_data = Column(JSONB, default=dict)
    output_data = Column(JSONB, default=dict)
    
    error_message = Column(Text, nullable=True)
    error_stack = Column(Text, nullable=True)
    
    entities_affected = Column(JSONB, default=list)
    
    meta_data = Column(JSONB, default=dict)
    
    automation = relationship("Automation", back_populates="logs")
    
    __table_args__ = (
        Index("ix_automation_logs_automation_date", "automation_id", "started_at"),
        Index("ix_automation_logs_status", "status"),
    )
    
    def complete(self, success: bool, output: Dict = None, error: str = None) -> None:
        self.completed_at = datetime.utcnow()
        self.duration_ms = int((self.completed_at - self.started_at).total_seconds() * 1000)
        self.status = "completed" if success else "failed"
        if output:
            self.output_data = output
        if error:
            self.error_message = error
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "run_id": self.run_id,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "duration_ms": self.duration_ms,
            "actions_executed": self.actions_executed,
            "error": self.error_message,
        }
