from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel
from datetime import datetime

from app.core.dependencies import AdminOnly
from app.db.session import get_db
from app.models import AuditLog, User

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    entity_type: str
    entity_id: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserActivitySummary(BaseModel):
    user_id: str
    user_email: str
    user_name: str
    user_role: str
    total_actions: int
    patients_created: int
    consultations_booked: int
    payments_recorded: int
    sessions_recorded: int
    other_actions: int
    last_activity_at: Optional[datetime] = None
    recent_actions: List[Dict[str, Any]] = []


def _resolve_user_info(user: Optional[User]):
    if not user:
        return None, "System / Automated", "system"
    email = user.email
    role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user.staff_profile:
        name = f"{user.staff_profile.first_name} {user.staff_profile.last_name}".strip()
    elif user.patient_profile:
        name = f"{user.patient_profile.first_name} {user.patient_profile.last_name}".strip()
    else:
        name = email.split("@")[0].replace(".", " ").title()
    return email, name, role


@router.get("", response_model=List[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
    user_id: Optional[str] = Query(None, description="Filter by user id"),
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

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    logs = query.all()

    result = []
    for log in logs:
        user_email, user_name, user_role = _resolve_user_info(log.user)
        result.append(
            AuditLogOut(
                id=log.id,
                user_id=log.user_id,
                user_email=user_email,
                user_name=user_name,
                user_role=user_role,
                action=log.action,
                entity_type=log.entity_type,
                entity_id=log.entity_id,
                detail=log.detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )

    return result


@router.get("/user-summary", response_model=List[UserActivitySummary])
def get_user_activity_summary(
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """
    Returns an aggregated breakdown of account activities:
    - Patients created
    - Appointments / consultations booked
    - Payments collected/recorded
    - Therapy sessions conducted / recorded
    - Recent activity timeline per account
    """
    users = db.query(User).all()
    summaries = []

    for u in users:
        email, name, role = _resolve_user_info(u)

        # Get logs for this user
        logs = (
            db.query(AuditLog)
            .filter(AuditLog.user_id == u.id)
            .order_by(desc(AuditLog.created_at))
            .all()
        )

        total_actions = len(logs)
        patients_created = 0
        consultations_booked = 0
        payments_recorded = 0
        sessions_recorded = 0
        other_actions = 0

        for log in logs:
            act = (log.action or "").upper()
            ent = (log.entity_type or "").upper()
            if "PATIENT" in ent and ("CREATE" in act or "REGISTER" in act):
                patients_created += 1
            elif "CONSULTATION" in ent or "APPOINTMENT" in ent or "BOOK" in act:
                consultations_booked += 1
            elif "PAYMENT" in ent or "RECEIPT" in ent or "BILLING" in ent:
                payments_recorded += 1
            elif "SESSION" in ent or "THERAPY" in ent:
                sessions_recorded += 1
            else:
                other_actions += 1

        recent = []
        for r in logs[:5]:
            recent.append({
                "id": r.id,
                "action": r.action,
                "entity_type": r.entity_type,
                "detail": r.detail,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        summaries.append(
            UserActivitySummary(
                user_id=u.id,
                user_email=email,
                user_name=name,
                user_role=role,
                total_actions=total_actions,
                patients_created=patients_created,
                consultations_booked=consultations_booked,
                payments_recorded=payments_recorded,
                sessions_recorded=sessions_recorded,
                other_actions=other_actions,
                last_activity_at=logs[0].created_at if logs else None,
                recent_actions=recent,
            )
        )

    # Sort by total_actions descending, then by last_activity_at
    summaries.sort(key=lambda s: (s.total_actions, s.last_activity_at or datetime.min), reverse=True)
    return summaries


class LoginLogOut(BaseModel):
    id: int
    user_id: Optional[str] = None
    user_email: str
    user_name: str
    user_role: str
    action: str
    status: str  # "Success" or "Failed"
    ip_address: Optional[str] = None
    detail: Optional[str] = None
    created_at: datetime


@router.get("/login-logs", response_model=List[LoginLogOut])
def get_account_login_logs(
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
    limit: int = Query(100, ge=1, le=500),
):
    """
    Dedicated endpoint for Clinic Administrator to audit login activity:
    Tracks successful logins and failed login attempts across all accounts.
    """
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.action.in_(["LOGIN", "LOGIN_FAILED"]))
        .order_by(desc(AuditLog.created_at))
        .limit(limit)
        .all()
    )

    results = []
    for log in logs:
        user_email, user_name, user_role = _resolve_user_info(log.user)
        if not user_email and log.detail and "for email '" in log.detail:
            try:
                user_email = log.detail.split("for email '")[1].split("'")[0]
            except Exception:
                user_email = "Unknown"
        results.append(
            LoginLogOut(
                id=log.id,
                user_id=log.user_id,
                user_email=user_email or "Unknown",
                user_name=user_name or "Unknown User",
                user_role=user_role or "guest",
                action=log.action,
                status="Success" if log.action == "LOGIN" else "Failed",
                ip_address=log.ip_address or "127.0.0.1",
                detail=log.detail,
                created_at=log.created_at,
            )
        )
    return results
