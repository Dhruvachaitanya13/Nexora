from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.category import Category, CategoryRule, CategoryType
from app.models.transaction import ScheduleCCategory

router = APIRouter()


class CategoryCreate(BaseModel):
    name: str
    category_type: str = "expense"
    parent_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_tax_deductible: bool = False
    schedule_c_category: Optional[str] = None
    budget_amount: Optional[float] = None
    keywords: Optional[List[str]] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_tax_deductible: Optional[bool] = None
    schedule_c_category: Optional[str] = None
    budget_amount: Optional[float] = None
    is_active: Optional[bool] = None


class CategoryRuleCreate(BaseModel):
    name: Optional[str] = None
    category_id: UUID
    merchant_contains: Optional[str] = None
    merchant_equals: Optional[str] = None
    merchant_starts_with: Optional[str] = None
    description_contains: Optional[str] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    mark_as_business: bool = False
    mark_as_tax_deductible: bool = False
    schedule_c_category: Optional[str] = None
    business_percentage: float = 100.0
    priority: int = 0


@router.get("", response_model=dict)
async def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    category_type: Optional[str] = None,
    include_system: bool = True,
) -> Any:
    """Get all categories."""
    
    query = db.query(Category).filter(
        Category.is_active == True,
    )
    
    if include_system:
        query = query.filter(
            (Category.user_id == current_user.id) | (Category.user_id == None)
        )
    else:
        query = query.filter(Category.user_id == current_user.id)
    
    if category_type:
        try:
            type_enum = CategoryType(category_type)
            query = query.filter(Category.category_type == type_enum)
        except ValueError:
            pass
    
    categories = query.order_by(Category.name).all()
    
    return {
        "categories": [
            {
                "id": str(c.id),
                "name": c.name,
                "type": c.category_type.value if c.category_type else None,
                "icon": c.icon,
                "color": c.color,
                "is_tax_deductible": c.is_tax_deductible,
                "schedule_c_category": c.schedule_c_category,
                "budget_amount": c.budget_amount,
                "is_system": c.user_id is None,
                "parent_id": str(c.parent_id) if c.parent_id else None,
            }
            for c in categories
        ],
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a custom category."""
    
    existing = db.query(Category).filter(
        Category.user_id == current_user.id,
        Category.name == category_data.name,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists",
        )
    
    try:
        cat_type = CategoryType(category_data.category_type)
    except ValueError:
        cat_type = CategoryType.EXPENSE
    
    category = Category(
        user_id=current_user.id,
        name=category_data.name,
        category_type=cat_type,
        parent_id=category_data.parent_id,
        icon=category_data.icon,
        color=category_data.color,
        is_tax_deductible=category_data.is_tax_deductible,
        schedule_c_category=category_data.schedule_c_category,
        budget_amount=category_data.budget_amount,
        keywords=category_data.keywords or [],
    )
    
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return {
        "id": str(category.id),
        "name": category.name,
        "type": category.category_type.value,
    }


@router.put("/{category_id}", response_model=dict)
async def update_category(
    category_id: UUID,
    category_data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update a category."""
    
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id,
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is a system category",
        )
    
    update_data = category_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    return {
        "id": str(category.id),
        "name": category.name,
        "message": "Category updated",
    }


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a custom category."""
    
    category = db.query(Category).filter(
        Category.id == category_id,
        Category.user_id == current_user.id,
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found or is a system category",
        )
    
    category.is_active = False
    db.commit()


@router.get("/rules", response_model=dict)
async def get_category_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get auto-categorization rules."""
    
    rules = db.query(CategoryRule).filter(
        CategoryRule.user_id == current_user.id,
        CategoryRule.is_enabled == True,
    ).order_by(CategoryRule.priority.desc()).all()
    
    return {
        "rules": [
            {
                "id": str(r.id),
                "name": r.name,
                "category_id": str(r.category_id),
                "merchant_contains": r.merchant_contains,
                "merchant_equals": r.merchant_equals,
                "mark_as_business": r.mark_as_business,
                "schedule_c_category": r.schedule_c_category,
                "match_count": r.match_count,
                "priority": r.priority,
            }
            for r in rules
        ],
    }


@router.post("/rules", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_category_rule(
    rule_data: CategoryRuleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create an auto-categorization rule."""
    
    category = db.query(Category).filter(
        Category.id == rule_data.category_id,
    ).first()
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found",
        )
    
    rule = CategoryRule(
        user_id=current_user.id,
        category_id=rule_data.category_id,
        name=rule_data.name,
        merchant_contains=rule_data.merchant_contains,
        merchant_equals=rule_data.merchant_equals,
        merchant_starts_with=rule_data.merchant_starts_with,
        description_contains=rule_data.description_contains,
        amount_min=rule_data.amount_min,
        amount_max=rule_data.amount_max,
        mark_as_business=rule_data.mark_as_business,
        mark_as_tax_deductible=rule_data.mark_as_tax_deductible,
        schedule_c_category=rule_data.schedule_c_category,
        business_percentage=rule_data.business_percentage,
        priority=rule_data.priority,
    )
    
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return {"id": str(rule.id), "message": "Rule created"}


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a categorization rule."""
    
    rule = db.query(CategoryRule).filter(
        CategoryRule.id == rule_id,
        CategoryRule.user_id == current_user.id,
    ).first()
    
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rule not found",
        )
    
    db.delete(rule)
    db.commit()


@router.get("/schedule-c", response_model=dict)
async def get_schedule_c_categories() -> Any:
    """Get IRS Schedule C categories."""
    
    categories = [
        {"value": c.value, "name": c.name.replace("_", " ").title(), "line": f"Line {i+8}"}
        for i, c in enumerate(ScheduleCCategory)
    ]
    
    return {"categories": categories}
