from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Text, Integer, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship, validates
from sqlalchemy.ext.hybrid import hybrid_property
from datetime import datetime
from typing import Optional, List, Dict, Any
import uuid
import enum

from app.db.base import Base


class CategoryType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    INVESTMENT = "investment"


class Category(Base):
    __tablename__ = "categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    name = Column(String(100), nullable=False)
    name_normalized = Column(String(100), nullable=False)
    display_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    category_type = Column(Enum(CategoryType), default=CategoryType.EXPENSE, nullable=False)
    
    parent_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    
    icon = Column(String(50), nullable=True)
    color = Column(String(10), nullable=True)
    emoji = Column(String(10), nullable=True)
    
    schedule_c_line = Column(String(10), nullable=True)
    schedule_c_category = Column(String(100), nullable=True)
    is_tax_deductible = Column(Boolean, default=False)
    deduction_rate = Column(Float, default=1.0)
    
    is_system = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_hidden = Column(Boolean, default=False)
    
    budget_amount = Column(Float, nullable=True)
    budget_period = Column(String(20), nullable=True)
    
    sort_order = Column(Integer, default=0)
    
    keywords = Column(ARRAY(String), default=list)
    merchant_patterns = Column(ARRAY(String), default=list)
    plaid_categories = Column(ARRAY(String), default=list)
    
    meta_data = Column(JSONB, default=dict)
    
    children = relationship("Category", backref="parent", remote_side=[id], lazy="selectin")
    rules = relationship("CategoryRule", back_populates="category", cascade="all, delete-orphan", lazy="selectin")
    
    __table_args__ = (
        Index("ix_categories_user_type", "user_id", "category_type"),
        Index("ix_categories_parent", "parent_id"),
        UniqueConstraint("user_id", "name_normalized", name="uq_user_category_name"),
    )
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.name and not self.name_normalized:
            self.name_normalized = self.name.lower().strip()
    
    @validates("name")
    def validate_name(self, key: str, value: str) -> str:
        if value:
            self.name_normalized = value.lower().strip()
        return value
    
    @hybrid_property
    def full_path(self) -> str:
        if self.parent:
            return f"{self.parent.full_path} > {self.name}"
        return self.name
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": str(self.id),
            "name": self.name,
            "display_name": self.display_name or self.name,
            "type": self.category_type.value if self.category_type else None,
            "icon": self.icon,
            "color": self.color,
            "is_tax_deductible": self.is_tax_deductible,
            "schedule_c_category": self.schedule_c_category,
        }


class CategoryRule(Base):
    __tablename__ = "category_rules"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    rule_type = Column(String(50), default="merchant_contains")
    
    merchant_contains = Column(String(255), nullable=True)
    merchant_equals = Column(String(255), nullable=True)
    merchant_starts_with = Column(String(255), nullable=True)
    merchant_ends_with = Column(String(255), nullable=True)
    merchant_regex = Column(String(500), nullable=True)
    
    amount_min = Column(Float, nullable=True)
    amount_max = Column(Float, nullable=True)
    amount_equals = Column(Float, nullable=True)
    
    description_contains = Column(String(255), nullable=True)
    
    plaid_category_contains = Column(String(255), nullable=True)
    
    mark_as_business = Column(Boolean, default=False)
    mark_as_tax_deductible = Column(Boolean, default=False)
    business_percentage = Column(Float, default=100.0)
    
    priority = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    match_count = Column(Integer, default=0)
    last_matched_at = Column(DateTime(timezone=True), nullable=True)
    
    meta_data = Column(JSONB, default=dict)
    
    category = relationship("Category", back_populates="rules")
    
    def matches(self, transaction) -> bool:
        if not self.is_active:
            return False
        
        if self.merchant_contains and transaction.merchant_name:
            if self.merchant_contains.lower() not in transaction.merchant_name.lower():
                return False
        
        if self.merchant_equals and transaction.merchant_name:
            if self.merchant_equals.lower() != transaction.merchant_name.lower():
                return False
        
        if self.amount_min is not None:
            if abs(transaction.amount) < self.amount_min:
                return False
        
        if self.amount_max is not None:
            if abs(transaction.amount) > self.amount_max:
                return False
        
        return True
    
    def record_match(self) -> None:
        self.match_count += 1
        self.last_matched_at = datetime.utcnow()


class ScheduleCCategory(Base):
    __tablename__ = "schedule_c_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    line_number = Column(String(10), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    irs_description = Column(Text, nullable=True)
    examples = Column(ARRAY(String), default=list)
    keywords = Column(ARRAY(String), default=list)
    
    deduction_rate = Column(Float, default=1.0)
    requires_documentation = Column(Boolean, default=False)
    documentation_notes = Column(Text, nullable=True)
    
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "line": self.line_number,
            "name": self.name,
            "description": self.description,
            "deduction_rate": self.deduction_rate,
            "examples": self.examples,
        }
