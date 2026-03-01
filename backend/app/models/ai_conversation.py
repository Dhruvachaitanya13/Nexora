from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base


class ConversationStatus(str, enum.Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"
    EXPIRED = "expired"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    FUNCTION = "function"
    TOOL = "tool"


class AgentType(str, enum.Enum):
    CFO = "cfo"
    TAX_ADVISOR = "tax_advisor"
    CASH_FLOW = "cash_flow"
    CATEGORIZATION = "categorization"
    INVOICE = "invoice"
    EXPENSE = "expense"
    FORECASTING = "forecasting"
    COMPLIANCE = "compliance"
    GENERAL = "general"
    COORDINATOR = "coordinator"


class InsightType(str, enum.Enum):
    TAX_SAVING = "tax_saving"
    EXPENSE_REDUCTION = "expense_reduction"
    INCOME_OPPORTUNITY = "income_opportunity"
    CASH_FLOW_WARNING = "cash_flow_warning"
    SPENDING_PATTERN = "spending_pattern"
    CATEGORY_SUGGESTION = "category_suggestion"
    INVOICE_REMINDER = "invoice_reminder"
    GOAL_PROGRESS = "goal_progress"
    MARKET_INSIGHT = "market_insight"
    COMPLIANCE_ALERT = "compliance_alert"
    OPTIMIZATION = "optimization"
    ANOMALY = "anomaly"


class InsightPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AIConversation(Base):
    __tablename__ = "ai_conversations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    
    status = Column(Enum(ConversationStatus), default=ConversationStatus.ACTIVE, nullable=False)
    
    primary_agent = Column(Enum(AgentType), default=AgentType.GENERAL, nullable=False)
    agents_used = Column(ARRAY(String), default=list)
    
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    
    message_count = Column(Integer, default=0)
    user_message_count = Column(Integer, default=0)
    assistant_message_count = Column(Integer, default=0)
    
    total_tokens_used = Column(Integer, default=0)
    total_input_tokens = Column(Integer, default=0)
    total_output_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    
    context_data = Column(JSONB, default=dict)
    
    financial_context_snapshot = Column(JSONB, default=dict)
    
    topics_discussed = Column(ARRAY(String), default=list)
    entities_mentioned = Column(JSONB, default=dict)
    actions_taken = Column(JSONB, default=list)
    recommendations_given = Column(JSONB, default=list)
    
    satisfaction_rating = Column(Integer, nullable=True)
    feedback = Column(Text, nullable=True)
    feedback_at = Column(DateTime(timezone=True), nullable=True)
    
    is_archived = Column(Boolean, default=False, nullable=False)
    is_starred = Column(Boolean, default=False, nullable=False)
    is_shared = Column(Boolean, default=False, nullable=False)
    
    share_token = Column(String(100), nullable=True)
    shared_at = Column(DateTime(timezone=True), nullable=True)
    share_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    user = relationship("User", back_populates="ai_conversations")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan", lazy="selectin", order_by="AIMessage.created_at")
    
    __table_args__ = (
        Index("ix_ai_conversations_user_status", "user_id", "status"),
        Index("ix_ai_conversations_user_date", "user_id", "started_at"),
        Index("ix_ai_conversations_agent", "primary_agent"),
    )
    
    @hybrid_property
    def duration_seconds(self) -> Optional[int]:
        if not self.ended_at:
            return None
        return int((self.ended_at - self.started_at).total_seconds())
    
    @hybrid_property
    def is_active(self) -> bool:
        return self.status == ConversationStatus.ACTIVE
    
    @hybrid_property
    def average_response_time(self) -> Optional[float]:
        return self.meta_data.get("average_response_time")
    
    def add_message(self, role: MessageRole, content: str, agent: AgentType = None, **kwargs) -> "AIMessage":
        message = AIMessage(
            conversation_id=self.id,
            role=role,
            content=content,
            agent_type=agent,
            **kwargs
        )
        
        self.message_count += 1
        if role == MessageRole.USER:
            self.user_message_count += 1
        elif role == MessageRole.ASSISTANT:
            self.assistant_message_count += 1
        
        self.last_message_at = datetime.utcnow()
        
        return message
    
    def add_agent_used(self, agent: AgentType) -> None:
        if not self.agents_used:
            self.agents_used = []
        agent_value = agent.value if isinstance(agent, AgentType) else agent
        if agent_value not in self.agents_used:
            self.agents_used.append(agent_value)
    
    def add_topic(self, topic: str) -> None:
        if not self.topics_discussed:
            self.topics_discussed = []
        if topic not in self.topics_discussed:
            self.topics_discussed.append(topic)
    
    def add_action(self, action: str, details: Dict = None) -> None:
        if not self.actions_taken:
            self.actions_taken = []
        self.actions_taken.append({
            "action": action,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def add_recommendation(self, title: str, description: str, priority: str = "medium", category: str = None) -> None:
        if not self.recommendations_given:
            self.recommendations_given = []
        self.recommendations_given.append({
            "title": title,
            "description": description,
            "priority": priority,
            "category": category,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def update_token_usage(self, input_tokens: int, output_tokens: int, cost: float = None) -> None:
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_tokens_used = self.total_input_tokens + self.total_output_tokens
        if cost:
            self.estimated_cost += cost
    
    def set_financial_context(self, context: Dict[str, Any]) -> None:
        self.financial_context_snapshot = context
    
    def complete(self) -> None:
        self.status = ConversationStatus.COMPLETED
        self.ended_at = datetime.utcnow()
    
    def archive(self) -> None:
        self.status = ConversationStatus.ARCHIVED
        self.is_archived = True
    
    def rate(self, rating: int, feedback: str = None) -> None:
        self.satisfaction_rating = min(5, max(1, rating))
        self.feedback = feedback
        self.feedback_at = datetime.utcnow()
    
    def generate_share_token(self, expires_hours: int = 24) -> str:
        import secrets
        self.share_token = secrets.token_urlsafe(32)
        self.is_shared = True
        self.shared_at = datetime.utcnow()
        self.share_expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
        return self.share_token
    
    def generate_title(self) -> str:
        if self.topics_discussed:
            return f"Discussion: {', '.join(self.topics_discussed[:3])}"
        if self.primary_agent:
            agent_names = {
                AgentType.CFO: "CFO Advisory",
                AgentType.TAX_ADVISOR: "Tax Planning",
                AgentType.CASH_FLOW: "Cash Flow Analysis",
                AgentType.CATEGORIZATION: "Expense Categorization",
                AgentType.INVOICE: "Invoice Management",
            }
            return agent_names.get(self.primary_agent, "Financial Discussion")
        return f"Conversation {self.started_at.strftime('%Y-%m-%d')}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "title": self.title or self.generate_title(),
            "status": self.status.value if self.status else None,
            "primary_agent": self.primary_agent.value if self.primary_agent else None,
            "agents_used": self.agents_used,
            "message_count": self.message_count,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_message_at": self.last_message_at.isoformat() if self.last_message_at else None,
            "topics": self.topics_discussed,
            "satisfaction_rating": self.satisfaction_rating,
        }


class AIMessage(Base):
    __tablename__ = "ai_messages"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(Enum(MessageRole), nullable=False)
    content = Column(Text, nullable=False)
    
    agent_type = Column(Enum(AgentType), nullable=True)
    agent_name = Column(String(100), nullable=True)
    
    parent_message_id = Column(UUID(as_uuid=True), ForeignKey("ai_messages.id", ondelete="SET NULL"), nullable=True)
    
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    
    model_used = Column(String(50), nullable=True)
    model_version = Column(String(20), nullable=True)
    temperature = Column(Float, nullable=True)
    
    latency_ms = Column(Integer, nullable=True)
    
    function_call = Column(JSONB, nullable=True)
    tool_calls = Column(JSONB, nullable=True)
    tool_results = Column(JSONB, nullable=True)
    
    context_used = Column(JSONB, nullable=True)
    
    entities_extracted = Column(JSONB, default=dict)
    intents_detected = Column(ARRAY(String), default=list)
    sentiment = Column(String(20), nullable=True)
    confidence_score = Column(Float, nullable=True)
    
    actions_suggested = Column(JSONB, default=list)
    follow_up_questions = Column(ARRAY(String), default=list)
    
    sources = Column(JSONB, default=list)
    citations = Column(JSONB, default=list)
    
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    original_content = Column(Text, nullable=True)
    
    is_flagged = Column(Boolean, default=False)
    flag_reason = Column(String(255), nullable=True)
    
    feedback_helpful = Column(Boolean, nullable=True)
    feedback_accurate = Column(Boolean, nullable=True)
    feedback_comment = Column(Text, nullable=True)
    feedback_at = Column(DateTime(timezone=True), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    conversation = relationship("AIConversation", back_populates="messages")
    
    __table_args__ = (
        Index("ix_ai_messages_conversation", "conversation_id", "created_at"),
        Index("ix_ai_messages_role", "role"),
        Index("ix_ai_messages_agent", "agent_type"),
    )
    
    def update_tokens(self, input_tokens: int, output_tokens: int) -> None:
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.total_tokens = input_tokens + output_tokens
    
    def add_entity(self, entity_type: str, value: Any, confidence: float = 1.0) -> None:
        if not self.entities_extracted:
            self.entities_extracted = {}
        if entity_type not in self.entities_extracted:
            self.entities_extracted[entity_type] = []
        self.entities_extracted[entity_type].append({
            "value": value,
            "confidence": confidence,
        })
    
    def add_intent(self, intent: str) -> None:
        if not self.intents_detected:
            self.intents_detected = []
        if intent not in self.intents_detected:
            self.intents_detected.append(intent)
    
    def add_action(self, action: str, params: Dict = None, executed: bool = False) -> None:
        if not self.actions_suggested:
            self.actions_suggested = []
        self.actions_suggested.append({
            "action": action,
            "params": params or {},
            "executed": executed,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    def mark_action_executed(self, action_index: int) -> None:
        if self.actions_suggested and 0 <= action_index < len(self.actions_suggested):
            self.actions_suggested[action_index]["executed"] = True
            self.actions_suggested[action_index]["executed_at"] = datetime.utcnow().isoformat()
    
    def add_source(self, source_type: str, source_id: str, description: str = None) -> None:
        if not self.sources:
            self.sources = []
        self.sources.append({
            "type": source_type,
            "id": source_id,
            "description": description,
        })
    
    def provide_feedback(self, helpful: bool = None, accurate: bool = None, comment: str = None) -> None:
        if helpful is not None:
            self.feedback_helpful = helpful
        if accurate is not None:
            self.feedback_accurate = accurate
        if comment:
            self.feedback_comment = comment
        self.feedback_at = datetime.utcnow()
    
    def edit(self, new_content: str) -> None:
        if not self.is_edited:
            self.original_content = self.content
        self.content = new_content
        self.is_edited = True
        self.edited_at = datetime.utcnow()
    
    def flag(self, reason: str) -> None:
        self.is_flagged = True
        self.flag_reason = reason
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "role": self.role.value if self.role else None,
            "content": self.content,
            "agent": self.agent_type.value if self.agent_type else None,
            "agent_name": self.agent_name,
            "tokens": self.total_tokens,
            "latency_ms": self.latency_ms,
            "actions": self.actions_suggested,
            "entities": self.entities_extracted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AIInsight(Base):
    __tablename__ = "ai_insights"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    insight_type = Column(Enum(InsightType), nullable=False)
    priority = Column(Enum(InsightPriority), default=InsightPriority.MEDIUM, nullable=False)
    
    title = Column(String(255), nullable=False)
    summary = Column(Text, nullable=False)
    detailed_explanation = Column(Text, nullable=True)
    
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)
    
    potential_savings = Column(Float, nullable=True)
    potential_revenue = Column(Float, nullable=True)
    risk_amount = Column(Float, nullable=True)
    confidence_score = Column(Float, default=0.0)
    
    impact_score = Column(Float, default=0.0)
    urgency_score = Column(Float, default=0.0)
    effort_score = Column(Float, default=0.0)
    
    data_points = Column(JSONB, default=dict)
    evidence = Column(JSONB, default=list)
    comparisons = Column(JSONB, default=dict)
    trends = Column(JSONB, default=dict)
    
    recommended_actions = Column(JSONB, default=list)
    action_steps = Column(JSONB, default=list)
    
    related_transactions = Column(ARRAY(UUID(as_uuid=True)), default=list)
    related_categories = Column(ARRAY(String), default=list)
    related_entities = Column(JSONB, default=dict)
    
    generated_by = Column(String(50), default="ai_engine")
    generation_model = Column(String(50), nullable=True)
    generation_context = Column(JSONB, default=dict)
    
    valid_from = Column(DateTime(timezone=True), default=datetime.utcnow)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    is_dismissed = Column(Boolean, default=False, nullable=False)
    is_actioned = Column(Boolean, default=False, nullable=False)
    is_saved = Column(Boolean, default=False, nullable=False)
    
    read_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    actioned_at = Column(DateTime(timezone=True), nullable=True)
    
    feedback_rating = Column(Integer, nullable=True)
    feedback_helpful = Column(Boolean, nullable=True)
    feedback_comment = Column(Text, nullable=True)
    feedback_at = Column(DateTime(timezone=True), nullable=True)
    
    refresh_frequency = Column(String(20), default="daily")
    last_refreshed_at = Column(DateTime(timezone=True), nullable=True)
    next_refresh_at = Column(DateTime(timezone=True), nullable=True)
    
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime(timezone=True), nullable=True)
    
    tags = Column(ARRAY(String), default=list)
    meta_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index("ix_ai_insights_user_type", "user_id", "insight_type"),
        Index("ix_ai_insights_user_priority", "user_id", "priority"),
        Index("ix_ai_insights_user_active", "user_id", "is_active", "is_dismissed"),
        Index("ix_ai_insights_valid", "valid_from", "valid_until"),
    )
    
    @hybrid_property
    def is_expired(self) -> bool:
        if not self.valid_until:
            return False
        return datetime.utcnow() > self.valid_until
    
    @hybrid_property
    def combined_score(self) -> float:
        return (self.impact_score * 0.4 + self.urgency_score * 0.35 + (10 - self.effort_score) * 0.25)
    
    @hybrid_property
    def roi_potential(self) -> Optional[float]:
        savings = self.potential_savings or 0
        revenue = self.potential_revenue or 0
        return savings + revenue if (savings or revenue) else None
    
    def mark_read(self) -> None:
        self.is_read = True
        self.read_at = datetime.utcnow()
    
    def dismiss(self) -> None:
        self.is_dismissed = True
        self.dismissed_at = datetime.utcnow()
    
    def mark_actioned(self) -> None:
        self.is_actioned = True
        self.actioned_at = datetime.utcnow()
    
    def save(self) -> None:
        self.is_saved = True
    
    def provide_feedback(self, rating: int = None, helpful: bool = None, comment: str = None) -> None:
        if rating is not None:
            self.feedback_rating = min(5, max(1, rating))
        if helpful is not None:
            self.feedback_helpful = helpful
        if comment:
            self.feedback_comment = comment
        self.feedback_at = datetime.utcnow()
    
    def add_action_step(self, title: str, description: str, is_completed: bool = False) -> None:
        if not self.action_steps:
            self.action_steps = []
        self.action_steps.append({
            "title": title,
            "description": description,
            "is_completed": is_completed,
            "added_at": datetime.utcnow().isoformat(),
        })
    
    def complete_action_step(self, index: int) -> None:
        if self.action_steps and 0 <= index < len(self.action_steps):
            self.action_steps[index]["is_completed"] = True
            self.action_steps[index]["completed_at"] = datetime.utcnow().isoformat()
    
    def add_evidence(self, evidence_type: str, data: Any, source: str = None) -> None:
        if not self.evidence:
            self.evidence = []
        self.evidence.append({
            "type": evidence_type,
            "data": data,
            "source": source,
            "added_at": datetime.utcnow().isoformat(),
        })
    
    def schedule_refresh(self, hours: int = 24) -> None:
        self.next_refresh_at = datetime.utcnow() + timedelta(hours=hours)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "type": self.insight_type.value if self.insight_type else None,
            "priority": self.priority.value if self.priority else None,
            "title": self.title,
            "summary": self.summary,
            "potential_savings": self.potential_savings,
            "confidence": self.confidence_score,
            "impact_score": self.impact_score,
            "recommended_actions": self.recommended_actions,
            "is_read": self.is_read,
            "is_actioned": self.is_actioned,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
