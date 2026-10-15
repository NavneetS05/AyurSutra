from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import AnyRole, StaffOnly
from app.db.session import get_db
from app.models import (
    Notification,
    Patient,
    PatientPackage,
    Payment,
    Room,
    SessionStatus,
    Staff,
    Therapy,
    TherapySession,
    TreatmentPlanItem,
    User,
)

router = APIRouter(prefix="/analytics", tags=["Analytics & Notifications"])


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    _: User = StaffOnly,
):
    """Aggregate utilization, revenue, and clinical metrics for dashboard & analytics."""
    # 1. Total Counts
    total_patients = db.query(Patient).count()
    total_sessions = db.query(TherapySession).count()
    completed_sessions = db.query(TherapySession).filter(TherapySession.status == SessionStatus.completed).count()
    overall_attendance = round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    # 2. Revenue Metrics
    total_invoiced = db.query(func.coalesce(func.sum(PatientPackage.custom_price), 0)).scalar()
    total_collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar()
    total_pending = float(total_invoiced) - float(total_collected)

    # 3. Therapy Popularity Breakdown
    therapies = db.query(Therapy).filter(Therapy.is_active == True).all()
    therapy_stats = []
    for th in therapies:
        count = (
            db.query(TherapySession)
            .join(TreatmentPlanItem, TherapySession.plan_item_id == TreatmentPlanItem.id)
            .filter(TreatmentPlanItem.therapy_id == th.id)
            .count()
        )
        therapy_stats.append({
            "name": th.name,
            "sessions": count,
            "duration": th.default_duration_minutes,
        })

    # 4. Therapist Workload Breakdown
    therapists = db.query(Staff).filter(Staff.is_therapist == True).all()
    therapist_stats = []
    for t in therapists:
        count = db.query(TherapySession).filter(TherapySession.therapist_id == t.id).count()
        completed = (
            db.query(TherapySession)
            .filter(TherapySession.therapist_id == t.id, TherapySession.status == SessionStatus.completed)
            .count()
        )
        therapist_stats.append({
            "name": f"{t.first_name} {t.last_name}",
            "assigned": count,
            "completed": completed,
        })

    # 5. Room Utilization
    rooms = db.query(Room).filter(Room.is_active == True).all()
    room_stats = []
    for r in rooms:
        count = db.query(TherapySession).filter(TherapySession.room_id == r.id).count()
        room_stats.append({
            "name": r.name,
            "bookings": count,
            "capacity": r.capacity,
        })

    # 6. Status Distribution
    status_counts = {}
    for st in SessionStatus:
        c = db.query(TherapySession).filter(TherapySession.status == st).count()
        if c > 0:
            status_counts[st.value.replace("_", " ").title()] = c

    return {
        "overview": {
            "total_patients": total_patients,
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "attendance_rate": overall_attendance,
            "total_invoiced": float(total_invoiced),
            "total_collected": float(total_collected),
            "balance_pending": max(0.0, total_pending),
        },
        "therapy_popularity": sorted(therapy_stats, key=lambda x: x["sessions"], reverse=True),
        "therapist_workload": therapist_stats,
        "room_utilization": room_stats,
        "status_distribution": [{"name": k, "value": v} for k, v in status_counts.items()],
    }


@router.get("/notifications", response_model=list[NotificationOut])
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = AnyRole,
):
    """Retrieve notifications for the authenticated user."""
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return notifications


@router.post("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = AnyRole,
):
    """Mark a notification as read."""
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"message": "Notification marked as read", "id": notification_id}
