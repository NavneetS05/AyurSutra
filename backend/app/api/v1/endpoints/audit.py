from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.dependencies import AdminOnly
from app.db.session import get_db
from app.models import AuditLog, User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """
    List chronological audit logs for system events, administrative changes, and clinical updates.
    Restricted to system Administrator role.
    """
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    logs = query.all()

    result = []
    for log in logs:
        user_email = None
        user_name = None
        if log.user:
            user_email = log.user.email
            user_name = f"{log.user.first_name} {log.user.last_name}"
        result.append(
            AuditLogOut(
                id=log.id,
                user_id=log.user_id,
                user_email=user_email,
                user_name=user_name,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                detail=log.detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )

    return result
