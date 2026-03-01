from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user, check_feature_access
from app.models.user import User
from app.models.automation import Automation, AutomationRule, AutomationLog, AutomationType, AutomationStatus, TriggerType

router = APIRouter()


class AutomationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    automation_type: str
    trigger_type: str = "event"
    trigger_config: Optional[dict] = None
    conditions: Optional[dict] = None
    actions: List[dict]
    schedule_cron: Optional[str] = None
    is_enabled: bool = True
    cooldown_minutes: Optional[int] = None
    max_runs_per_day: Optional[int] = None


class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_config: Optional[dict] = None
    conditions: Optional[dict] = None
    actions: Optional[List[dict]] = None
    schedule_cron: Optional[str] = None
    status: Optional[str] = None
    cooldown_minutes: Optional[int] = None
    max_runs_per_day: Optional[int] = None


@router.get("", response_model=dict)
async def get_automations(
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
    automation_type: Optional[str] = None,
    include_disabled: bool = False,
) -> Any:
    """Get all automation rules."""
    
    query = db.query(Automation).filter(
        Automation.user_id == current_user.id,
    )
    
    if not include_disabled:
        query = query.filter(Automation.status == AutomationStatus.ACTIVE)
    
    if automation_type:
        try:
            type_enum = AutomationType(automation_type)
            query = query.filter(Automation.automation_type == type_enum)
        except ValueError:
            pass
    
    automations = query.order_by(Automation.name).all()
    
    return {
        "automations": [
            {
                "id": str(a.id),
                "name": a.name,
                "description": a.description,
                "type": a.automation_type.value,
                "trigger_type": a.trigger_type.value,
                "status": a.status.value,
                "run_count": a.run_count,
                "success_count": a.success_count,
                "success_rate": a.success_rate,
                "last_run": a.last_run_at.isoformat() if a.last_run_at else None,
                "next_run": a.next_run_at.isoformat() if a.next_run_at else None,
            }
            for a in automations
        ],
    }


@router.get("/{automation_id}", response_model=dict)
async def get_automation(
    automation_id: UUID,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Get automation details."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    logs = db.query(AutomationLog).filter(
        AutomationLog.automation_id == automation_id,
    ).order_by(desc(AutomationLog.started_at)).limit(20).all()
    
    return {
        "automation": {
            "id": str(automation.id),
            "name": automation.name,
            "description": automation.description,
            "type": automation.automation_type.value,
            "trigger_type": automation.trigger_type.value,
            "trigger_config": automation.trigger_config,
            "conditions": automation.conditions,
            "actions": automation.actions,
            "schedule_cron": automation.schedule_cron,
            "status": automation.status.value,
            "run_count": automation.run_count,
            "success_count": automation.success_count,
            "failure_count": automation.failure_count,
            "last_run": automation.last_run_at.isoformat() if automation.last_run_at else None,
            "cooldown_minutes": automation.cooldown_minutes,
            "max_runs_per_day": automation.max_runs_per_day,
        },
        "recent_runs": [
            {
                "id": str(log.id),
                "status": log.status,
                "started_at": log.started_at.isoformat(),
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
                "duration_ms": log.duration_ms,
                "error": log.error_message,
            }
            for log in logs
        ],
    }


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_automation(
    automation_data: AutomationCreate,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Create a new automation rule."""
    
    try:
        automation_type = AutomationType(automation_data.automation_type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid automation type. Valid: {[t.value for t in AutomationType]}",
        )
    
    try:
        trigger_type = TriggerType(automation_data.trigger_type)
    except ValueError:
        trigger_type = TriggerType.EVENT
    
    automation = Automation(
        user_id=current_user.id,
        name=automation_data.name,
        description=automation_data.description,
        automation_type=automation_type,
        trigger_type=trigger_type,
        trigger_config=automation_data.trigger_config or {},
        conditions=automation_data.conditions or {},
        actions=automation_data.actions,
        schedule_cron=automation_data.schedule_cron,
        status=AutomationStatus.ACTIVE if automation_data.is_enabled else AutomationStatus.PAUSED,
        cooldown_minutes=automation_data.cooldown_minutes,
        max_runs_per_day=automation_data.max_runs_per_day,
    )
    
    db.add(automation)
    db.commit()
    db.refresh(automation)
    
    return {
        "id": str(automation.id),
        "name": automation.name,
        "message": "Automation created successfully",
    }


@router.put("/{automation_id}", response_model=dict)
async def update_automation(
    automation_id: UUID,
    automation_data: AutomationUpdate,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Update an automation rule."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    update_data = automation_data.dict(exclude_unset=True)
    
    if "status" in update_data:
        try:
            update_data["status"] = AutomationStatus(update_data["status"])
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status",
            )
    
    for field, value in update_data.items():
        setattr(automation, field, value)
    
    db.commit()
    db.refresh(automation)
    
    return {"id": str(automation.id), "message": "Automation updated"}


@router.post("/{automation_id}/run", response_model=dict)
async def run_automation(
    automation_id: UUID,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Manually trigger an automation."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    if not automation.is_runnable:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Automation cannot run (disabled, in cooldown, or max runs reached)",
        )
    
    log = AutomationLog(
        automation_id=automation.id,
        trigger_type="manual",
        status="running",
    )
    db.add(log)
    
    try:
        log.status = "success"
        automation.record_run(success=True)
    except Exception as e:
        log.status = "failed"
        log.error_message = str(e)
        automation.record_run(success=False)
    
    log.completed_at = datetime.utcnow()
    log.duration_ms = int((log.completed_at - log.started_at).total_seconds() * 1000)
    
    db.commit()
    
    return {
        "log_id": str(log.id),
        "status": log.status,
        "message": f"Automation {'completed successfully' if log.status == 'success' else 'failed'}",
    }


@router.post("/{automation_id}/pause", response_model=dict)
async def pause_automation(
    automation_id: UUID,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Pause an automation."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    automation.pause()
    db.commit()
    
    return {"message": "Automation paused"}


@router.post("/{automation_id}/resume", response_model=dict)
async def resume_automation(
    automation_id: UUID,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> Any:
    """Resume a paused automation."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    automation.resume()
    db.commit()
    
    return {"message": "Automation resumed"}


@router.delete("/{automation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_automation(
    automation_id: UUID,
    current_user: User = Depends(check_feature_access("automations")),
    db: Session = Depends(get_db),
) -> None:
    """Delete an automation."""
    
    automation = db.query(Automation).filter(
        Automation.id == automation_id,
        Automation.user_id == current_user.id,
    ).first()
    
    if not automation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Automation not found",
        )
    
    automation.disable()
    db.commit()


@router.get("/types/list", response_model=dict)
async def list_automation_types() -> Any:
    """Get available automation types."""
    
    return {
        "types": [
            {
                "value": t.value,
                "name": t.name.replace("_", " ").title(),
                "description": {
                    "categorization": "Automatically categorize transactions",
                    "tax_alert": "Alert when tax deadlines approach",
                    "cash_flow_alert": "Alert on cash flow changes",
                    "invoice_reminder": "Send invoice payment reminders",
                    "goal_contribution": "Auto-contribute to goals",
                    "report_generation": "Generate periodic reports",
                    "data_sync": "Sync data from connected accounts",
                    "insight_generation": "Generate AI insights",
                    "anomaly_detection": "Detect unusual transactions",
                }.get(t.value, ""),
            }
            for t in AutomationType
        ],
        "trigger_types": [
            {"value": t.value, "name": t.name.replace("_", " ").title()}
            for t in TriggerType
        ],
    }
