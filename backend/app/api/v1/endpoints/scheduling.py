"""Scheduling endpoints — allocate, view, check-in, and record sessions."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import (
    AdminOrReceptionist,
    StaffOnly,
    TherapistOnly,
    get_current_user,
)
from app.db.session import get_db
from app.models import (
    Patient,
    SessionRecord,
    SessionStatus,
    TherapySession,
    TreatmentPlan,
    TreatmentPlanItem,
    User,
    UserRole,
)
from app.services.scheduler import SchedulingEngine

router = APIRouter(prefix="/scheduling", tags=["Scheduling"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AllocateRequest(BaseModel):
    treatment_plan_id: str
    preferred_start_date: date
    preferred_therapist_ids: Optional[list[str]] = None
    preferred_room_ids: Optional[list[str]] = None


class SessionOut(BaseModel):
    id: str
    plan_item_id: str
    therapist_id: str
    therapist_name: Optional[str] = None
    room_id: str
    room_name: Optional[str] = None
    therapy_name: Optional[str] = None
    patient_name: Optional[str] = None
    session_number: int
    scheduled_start: datetime
    scheduled_end: datetime
    status: SessionStatus
    record_observations: Optional[str] = None
    record_feedback: Optional[str] = None
    flagged_for_doctor: Optional[bool] = None


class RescheduleRequestIn(BaseModel):
    preferred_date: date
    reason: str


class PatientFeedbackIn(BaseModel):
    feedback: str
    flag_doctor: bool = False


class AllocationSummary(BaseModel):
    therapy_name: str
    sessions_allocated: int
    sessions_unassigned: int
    conflicts: list[str]


class AllocateResponse(BaseModel):
    sessions: list[SessionOut]
    summary: list[AllocationSummary]


class CheckInRequest(BaseModel):
    session_id: str


class RecommendSlotsRequest(BaseModel):
    therapy_id: str
    patient_id: str
    duration_minutes: int = 60
    preferred_start_date: Optional[date] = None
    top_n: int = 3


class RankedSlotOut(BaseModel):
    slot_start: datetime
    slot_end: datetime
    therapist_id: str
    therapist_name: str
    room_id: str
    room_name: str
    score: float
    rank: int
    reasons: list[str]


class SessionRecordCreate(BaseModel):
    session_id: str
    observations: Optional[str] = None
    patient_feedback: Optional[str] = None
    oils_used: Optional[str] = None
    pressure_level: Optional[str] = None
    therapist_notes: Optional[str] = None
    flagged_for_doctor: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/allocate", response_model=AllocateResponse)
def allocate_sessions(
    body: AllocateRequest,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    """Allocate all sessions for a finalized treatment plan."""
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == body.treatment_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if not plan.is_finalized:
        raise HTTPException(status_code=400, detail="Plan must be finalized before scheduling")

    patient_id = plan.consultation.patient_id

    engine = SchedulingEngine(
        db=db,
        clinic_open=settings.clinic_open,
        clinic_close=settings.clinic_close,
    )
    results = engine.allocate(
        plan_items=plan.items,
        patient_id=patient_id,
        preferred_start_date=body.preferred_start_date,
        preferred_therapist_ids=body.preferred_therapist_ids,
        preferred_room_ids=body.preferred_room_ids,
    )

    all_sessions = []
    summary = []
    for result in results:
        for session in result.assigned:
            db.add(session)
        all_sessions.extend(result.assigned)
        summary.append(
            AllocationSummary(
                therapy_name=result.therapy_name,
                sessions_allocated=len(result.assigned),
                sessions_unassigned=result.unassigned_count,
                conflicts=result.conflicts,
            )
        )

    db.commit()
    for session in all_sessions:
        db.refresh(session)

    return AllocateResponse(
        sessions=[
            SessionOut(
                id=s.id,
                plan_item_id=s.plan_item_id,
                therapist_id=s.therapist_id,
                room_id=s.room_id,
                session_number=s.session_number,
                scheduled_start=s.scheduled_start,
                scheduled_end=s.scheduled_end,
                status=s.status,
            )
            for s in all_sessions
        ],
        summary=summary,
    )


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(
    therapist_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    session_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(TherapySession)

    if current_user.role == UserRole.therapist:
        # Therapists only see their own sessions
        staff = current_user.staff_profile
        if staff:
            q = q.filter(TherapySession.therapist_id == staff.id)
    elif current_user.role == UserRole.patient:
        # Patients only see their own sessions
        p = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if p:
            # Join through plan_items -> treatment_plan -> consultation
            from app.models import Consultation, TreatmentPlanItem
            q = (
                q.join(TreatmentPlanItem, TherapySession.plan_item_id == TreatmentPlanItem.id)
                .join(TreatmentPlan, TreatmentPlanItem.plan_id == TreatmentPlan.id)
                .join(Consultation, TreatmentPlan.consultation_id == Consultation.id)
                .filter(Consultation.patient_id == p.id)
            )
        else:
            return []
    else:
        if therapist_id:
            q = q.filter(TherapySession.therapist_id == therapist_id)

    if session_date:
        start = datetime.combine(session_date, datetime.min.time())
        end = datetime.combine(session_date, datetime.max.time())
        q = q.filter(
            TherapySession.scheduled_start >= start,
            TherapySession.scheduled_start <= end,
        )

    sessions = q.order_by(TherapySession.scheduled_start).all()
    results = []
    for s in sessions:
        t_name = f"{s.therapist.first_name} {s.therapist.last_name}" if s.therapist else None
        r_name = s.room.name if s.room else None
        th_name = s.plan_item.therapy.name if s.plan_item and s.plan_item.therapy else None
        p_name = None
        if s.plan_item and s.plan_item.plan and s.plan_item.plan.consultation and s.plan_item.plan.consultation.patient:
            pat = s.plan_item.plan.consultation.patient
            p_name = f"{pat.first_name} {pat.last_name}"

        results.append(
            SessionOut(
                id=s.id,
                plan_item_id=s.plan_item_id,
                therapist_id=s.therapist_id,
                therapist_name=t_name,
                room_id=s.room_id,
                room_name=r_name,
                therapy_name=th_name,
                patient_name=p_name,
                session_number=s.session_number,
                scheduled_start=s.scheduled_start,
                scheduled_end=s.scheduled_end,
                status=s.status,
                record_observations=s.record.observations if s.record else None,
                record_feedback=s.record.patient_feedback if s.record else None,
                flagged_for_doctor=s.record.flagged_for_doctor if s.record else None,
            )
        )
    return results


@router.post("/sessions/{session_id}/checkin")
def check_in(
    session_id: str,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in [SessionStatus.scheduled, SessionStatus.confirmed]:
        raise HTTPException(status_code=400, detail=f"Cannot check in session with status: {session.status}")
    session.status = SessionStatus.checked_in
    session.actual_start = datetime.utcnow()
    db.commit()
    return {"message": "Checked in", "session_id": session_id}


@router.post("/sessions/{session_id}/complete")
def complete_session(
    session_id: str,
    body: SessionRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in [UserRole.therapist, UserRole.doctor, UserRole.admin]:
        raise HTTPException(status_code=403, detail="Access denied")

    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status == SessionStatus.completed:
        raise HTTPException(status_code=400, detail="Session already completed")

    session.status = SessionStatus.completed
    session.actual_end = datetime.utcnow()

    record = SessionRecord(
        session_id=session_id,
        observations=body.observations,
        patient_feedback=body.patient_feedback,
        oils_used=body.oils_used,
        pressure_level=body.pressure_level,
        therapist_notes=body.therapist_notes,
        flagged_for_doctor=body.flagged_for_doctor,
    )
    db.add(record)
    db.commit()
    return {"message": "Session completed", "session_id": session_id}


@router.post("/sessions/{session_id}/mark-missed")
def mark_missed(
    session_id: str,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = SessionStatus.missed
    db.commit()
    return {"message": "Session marked as missed", "session_id": session_id}


@router.post("/sessions/{session_id}/reschedule-request")
def request_reschedule(
    session_id: str,
    body: RescheduleRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If patient, verify ownership
    if current_user.role == UserRole.patient:
        pat = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        plan_pat = session.plan_item.plan.consultation.patient
        if not pat or plan_pat.id != pat.id:
            raise HTTPException(status_code=403, detail="Access denied")

    from app.models import Notification, AuditLog
    # Create notification for staff
    admin_users = db.query(User).filter(User.role.in_([UserRole.admin, UserRole.receptionist])).all()
    for u in admin_users:
        db.add(
            Notification(
                user_id=u.id,
                title="Reschedule Request",
                body=f"Patient requested reschedule for Session #{session.session_number} to {body.preferred_date}. Reason: {body.reason}",
            )
        )

    # Log audit
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="REQUEST_RESCHEDULE",
            entity_type="TherapySession",
            entity_id=session.id,
            detail=f"Preferred: {body.preferred_date}. Reason: {body.reason}",
        )
    )

    db.commit()
    return {"message": "Reschedule request submitted successfully", "session_id": session_id}


@router.post("/sessions/{session_id}/feedback")
def submit_patient_feedback(
    session_id: str,
    body: PatientFeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If patient, verify ownership
    if current_user.role == UserRole.patient:
        pat = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        plan_pat = session.plan_item.plan.consultation.patient
        if not pat or plan_pat.id != pat.id:
            raise HTTPException(status_code=403, detail="Access denied")

    if not session.record:
        # Create record stub if none exists
        session.record = SessionRecord(
            session_id=session.id,
            patient_feedback=body.feedback,
            flagged_for_doctor=body.flag_doctor,
        )
        db.add(session.record)
    else:
        session.record.patient_feedback = body.feedback
        if body.flag_doctor:
            session.record.flagged_for_doctor = True

    # If flagged for doctor, notify doctor
    if body.flag_doctor:
        doc = session.plan_item.plan.consultation.doctor
        if doc and doc.user_id:
            from app.models import Notification
            db.add(
                Notification(
                    user_id=doc.user_id,
                    title="Patient Feedback Flagged for Doctor",
                    body=f"Patient flagged feedback for Session #{session.session_number}: {body.feedback}",
                )
            )

    db.commit()
    return {"message": "Feedback submitted successfully", "session_id": session_id}


@router.post("/recommend-slots", response_model=list[RankedSlotOut])
def recommend_ranked_slots(
    body: RecommendSlotsRequest,
    db: Session = Depends(get_db),
    _: User = StaffOnly,
):
    """Recommend the top-N optimal, ranked slots for a therapy based on Ayurvedic circadian timing,
    therapist workload balance, and specialized room facilities."""
    engine = SchedulingEngine(
        db=db,
        clinic_open=settings.clinic_open,
        clinic_close=settings.clinic_close,
    )
    ranked = engine.recommend_slots(
        therapy_id=body.therapy_id,
        patient_id=body.patient_id,
        duration_minutes=body.duration_minutes,
        preferred_start_date=body.preferred_start_date,
        top_n=body.top_n,
    )
    return [
        RankedSlotOut(
            slot_start=r.slot_start,
            slot_end=r.slot_end,
            therapist_id=r.therapist_id,
            therapist_name=r.therapist_name,
            room_id=r.room_id,
            room_name=r.room_name,
            score=r.score,
            rank=r.rank,
            reasons=r.reasons,
        )
        for r in ranked
    ]
