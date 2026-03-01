from datetime import datetime, date, timedelta
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.goal import Goal, GoalType, GoalStatus, GoalContribution

router = APIRouter()


class GoalCreate(BaseModel):
    name: str
    description: Optional[str] = None
    goal_type: str
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0.0, ge=0)
    target_date: Optional[date] = None
    monthly_contribution_target: Optional[float] = None
    linked_account_id: Optional[UUID] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    target_amount: Optional[float] = Field(None, gt=0)
    target_date: Optional[date] = None
    monthly_contribution_target: Optional[float] = None
    status: Optional[str] = None
    linked_account_id: Optional[UUID] = None


class ContributionCreate(BaseModel):
    amount: float = Field(..., gt=0)
    contribution_date: Optional[date] = None
    source: Optional[str] = None
    note: Optional[str] = None


@router.get("", response_model=dict)
async def get_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_completed: bool = False,
    goal_type: Optional[str] = None,
) -> Any:
    """Get all goals."""
    
    query = db.query(Goal).filter(Goal.user_id == current_user.id)
    
    if not include_completed:
        query = query.filter(Goal.status.notin_([GoalStatus.COMPLETED, GoalStatus.CANCELLED]))
    
    if goal_type:
        try:
            type_enum = GoalType(goal_type)
            query = query.filter(Goal.goal_type == type_enum)
        except ValueError:
            pass
    
    goals = query.order_by(Goal.target_date.nulls_last(), Goal.created_at).all()
    
    total_target = sum(g.target_amount for g in goals)
    total_current = sum(g.current_amount for g in goals)
    
    return {
        "goals": [
            {
                "id": str(g.id),
                "name": g.name,
                "type": g.goal_type.value,
                "target_amount": g.target_amount,
                "current_amount": g.current_amount,
                "progress": g.progress_percentage,
                "target_date": str(g.target_date) if g.target_date else None,
                "days_remaining": g.days_remaining,
                "status": g.status.value,
                "is_on_track": g.status.value in ["on_track", "completed"],
                "monthly_contribution_target": g.monthly_contribution_target,
            }
            for g in goals
        ],
        "summary": {
            "total_goals": len(goals),
            "total_target": total_target,
            "total_current": total_current,
            "overall_progress": (total_current / total_target * 100) if total_target > 0 else 0,
            "on_track": len([g for g in goals if g.status.value in ["on_track", "completed"]]),
            "behind": len([g for g in goals if g.status.value == "behind"]),
        },
    }


@router.get("/{goal_id}", response_model=dict)
async def get_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Get goal details with contribution history."""
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id,
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    
    contributions = db.query(GoalContribution).filter(
        GoalContribution.goal_id == goal_id,
    ).order_by(desc(GoalContribution.contribution_date)).limit(50).all()
    
    return {
        "goal": {
            "id": str(goal.id),
            "name": goal.name,
            "description": goal.description,
            "type": goal.goal_type.value,
            "target_amount": goal.target_amount,
            "current_amount": goal.current_amount,
            "progress": goal.progress_percentage,
            "amount_remaining": goal.amount_remaining,
            "target_date": str(goal.target_date) if goal.target_date else None,
            "days_remaining": goal.days_remaining,
            "status": goal.status.value,
            "monthly_contribution_target": goal.monthly_contribution_target,
            "required_monthly": goal.required_monthly_contribution,
            "created_at": goal.created_at.isoformat(),
        },
        "contributions": [
            {
                "id": str(c.id),
                "amount": c.amount,
                "date": str(c.contribution_date),
                "balance_after": c.balance_after,
                "source": c.source,
                "note": c.note,
            }
            for c in contributions
        ],
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_goal(
    goal_data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new financial goal."""
    
    try:
        goal_type = GoalType(goal_data.goal_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid goal type. Valid types: {[t.value for t in GoalType]}",
        )
    
    goal = Goal(
        user_id=current_user.id,
        name=goal_data.name,
        description=goal_data.description,
        goal_type=goal_type,
        target_amount=goal_data.target_amount,
        current_amount=goal_data.current_amount,
        target_date=goal_data.target_date,
        monthly_contribution_target=goal_data.monthly_contribution_target,
        linked_account_id=goal_data.linked_account_id,
        icon=goal_data.icon,
        color=goal_data.color,
        status=GoalStatus.NOT_STARTED if goal_data.current_amount == 0 else GoalStatus.IN_PROGRESS,
    )
    
    db.add(goal)
    db.commit()
    db.refresh(goal)
    
    return {
        "id": str(goal.id),
        "name": goal.name,
        "type": goal.goal_type.value,
        "target_amount": goal.target_amount,
        "progress": goal.progress_percentage,
    }


@router.put("/{goal_id}", response_model=dict)
async def update_goal(
    goal_id: UUID,
    goal_data: GoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Update a goal."""
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id,
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    
    update_data = goal_data.dict(exclude_unset=True)
    
    if "status" in update_data:
        try:
            update_data["status"] = GoalStatus(update_data["status"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status",
            )
    
    for field, value in update_data.items():
        setattr(goal, field, value)
    
    goal.update_status()
    db.commit()
    db.refresh(goal)
    
    return {
        "id": str(goal.id),
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "progress": goal.progress_percentage,
        "status": goal.status.value,
    }


@router.post("/{goal_id}/contribute", response_model=dict)
async def add_contribution(
    goal_id: UUID,
    contribution_data: ContributionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """Add a contribution to a goal."""
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id,
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    
    if goal.status in [GoalStatus.COMPLETED, GoalStatus.CANCELLED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add contribution to completed or cancelled goal",
        )
    
    contribution = GoalContribution(
        goal_id=goal.id,
        amount=contribution_data.amount,
        contribution_date=contribution_data.contribution_date or date.today(),
        source=contribution_data.source,
        note=contribution_data.note,
        balance_after=goal.current_amount + contribution_data.amount,
    )
    
    db.add(contribution)
    
    goal.current_amount += contribution_data.amount
    goal.update_status()
    
    if goal.is_completed:
        goal.status = GoalStatus.COMPLETED
        goal.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "contribution_id": str(contribution.id),
        "amount": contribution_data.amount,
        "new_balance": goal.current_amount,
        "progress": goal.progress_percentage,
        "is_completed": goal.is_completed,
    }


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a goal."""
    
    goal = db.query(Goal).filter(
        Goal.id == goal_id,
        Goal.user_id == current_user.id,
    ).first()
    
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Goal not found",
        )
    
    goal.status = GoalStatus.CANCELLED
    db.commit()


@router.get("/types/list", response_model=dict)
async def list_goal_types() -> Any:
    """Get available goal types."""
    
    return {
        "types": [
            {
                "value": t.value,
                "name": t.name.replace("_", " ").title(),
                "description": {
                    "savings": "Build savings for a specific purpose",
                    "emergency_fund": "Build an emergency reserve fund",
                    "tax_reserve": "Save for upcoming tax payments",
                    "debt_payoff": "Pay off a debt or loan",
                    "retirement": "Save for retirement",
                    "income": "Reach an income target",
                    "expense_reduction": "Reduce spending in a category",
                    "investment": "Reach an investment goal",
                    "custom": "Custom financial goal",
                }.get(t.value, ""),
            }
            for t in GoalType
        ],
    }
