from sqlalchemy import Column, DateTime, func, inspect, String
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import as_declarative, declarative_mixin
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
from typing import Any, Dict, List, Optional, Type, TypeVar
import uuid
import re

T = TypeVar("T", bound="Base")


@as_declarative()
class Base:
    id: Any
    __name__: str
    
    @declared_attr
    def __tablename__(cls) -> str:
        name = cls.__name__
        return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower() + 's'
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    def to_dict(self, exclude: List[str] = None, include: List[str] = None) -> Dict[str, Any]:
        exclude = exclude or []
        result = {}
        for column in inspect(self.__class__).columns:
            if column.name in exclude:
                continue
            if include and column.name not in include:
                continue
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                value = value.isoformat()
            elif isinstance(value, uuid.UUID):
                value = str(value)
            result[column.name] = value
        return result
    
    def update_from_dict(self, data: Dict[str, Any], exclude: List[str] = None) -> None:
        exclude = exclude or ["id", "created_at", "updated_at"]
        for key, value in data.items():
            if key not in exclude and hasattr(self, key):
                setattr(self, key, value)
    
    @classmethod
    def get_columns(cls) -> List[str]:
        return [column.name for column in inspect(cls).columns]
    
    @classmethod
    def get_relationships(cls) -> List[str]:
        return [rel.key for rel in inspect(cls).relationships]
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
    
    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, self.__class__):
            return False
        return self.id == other.id
    
    def __hash__(self) -> int:
        return hash(self.id)


@declarative_mixin
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


@declarative_mixin
class SoftDeleteMixin:
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    is_deleted = Column(String(1), default='N', nullable=False)
    
    def soft_delete(self) -> None:
        self.deleted_at = datetime.utcnow()
        self.is_deleted = 'Y'
    
    def restore(self) -> None:
        self.deleted_at = None
        self.is_deleted = 'N'
    
    @property
    def is_active(self) -> bool:
        return self.is_deleted == 'N'


@declarative_mixin
class AuditMixin:
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True)


@declarative_mixin
class VersionMixin:
    version = Column(String(10), default="1", nullable=False)
    
    def increment_version(self) -> None:
        current = int(self.version)
        self.version = str(current + 1)
