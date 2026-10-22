"""Scheduling endpoints — allocate, view, check-in, and record sessions."""
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import (
    AdminOrReceptionist,
    DoctorAdminOrReceptionist,
    StaffOnly,
    TherapistOnly,
    get_current_user,
    AnyRole,
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
    Consultation,
    Room,
    Staff,
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
    _: User = DoctorAdminOrReceptionist,
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
    current_user: User = AdminOrReceptionist,
):
    session = db.query(TherapySession).filter(TherapySession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status not in [SessionStatus.scheduled, SessionStatus.confirmed]:
        raise HTTPException(status_code=400, detail=f"Cannot check in session with status: {session.status}")
    session.status = SessionStatus.checked_in
    from app.models import now_ist
    session.actual_start = now_ist()

    from app.models import AuditLog
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="SESSION_CHECK_IN",
            entity_type="TherapySession",
            entity_id=session.id,
            detail=f"Patient checked in for Session #{session.session_number}",
        )
    )
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
    from app.models import now_ist
    session.actual_end = now_ist()

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

    from app.models import AuditLog
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="SESSION_COMPLETED",
            entity_type="TherapySession",
            entity_id=session.id,
            detail=f"Session #{session.session_number} completed. Flagged for doctor: {body.flagged_for_doctor}",
        )
    )
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


# ---------------------------------------------------------------------------
# Daywise and Upcoming Patients
# ---------------------------------------------------------------------------

class DaywiseConsultation(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    doctor_id: str
    doctor_name: str
    scheduled_at: datetime
    consultation_type: str
    chief_complaint: Optional[str] = None
    fee_paid: bool


class DaywiseTherapySession(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    patient_phone: Optional[str] = None
    therapy_name: str
    session_number: int
    therapist_name: str
    room_name: str
    scheduled_start: datetime
    scheduled_end: datetime
    status: str


class DaywiseScheduleOut(BaseModel):
    date: str
    day_name: str
    is_today: bool
    total_unique_patients: int
    consultations: List[DaywiseConsultation]
    therapy_sessions: List[DaywiseTherapySession]


@router.get("/daywise", response_model=List[DaywiseScheduleOut])
def get_daywise_schedule(
    start_date: Optional[date] = Query(None, description="Start date (defaults to today)"),
    days: int = Query(7, ge=1, le=30, description="Number of days to fetch"),
    search: Optional[str] = Query(None, description="Filter by patient name"),
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    """
    Daywise and upcoming patients view:
    Returns scheduled Doctor Consultations and Panchakarma Therapy Sessions grouped by day.
    """
    base_date = start_date or date.today()
    today_date = date.today()

    range_start = datetime.combine(base_date, datetime.min.time())
    range_end = datetime.combine(base_date + timedelta(days=days), datetime.max.time())

    # 1. Fetch consultations
    consultations_query = (
        db.query(Consultation)
        .filter(Consultation.scheduled_at >= range_start, Consultation.scheduled_at <= range_end)
        .order_by(Consultation.scheduled_at)
    )
    all_consultations = consultations_query.all()

    # 2. Fetch therapy sessions
    sessions_query = (
        db.query(TherapySession)
        .filter(TherapySession.scheduled_start >= range_start, TherapySession.scheduled_start <= range_end)
        .order_by(TherapySession.scheduled_start)
    )
    all_sessions = sessions_query.all()

    results: List[DaywiseScheduleOut] = []

    for d in range(days):
        current_day = base_date + timedelta(days=d)
        day_str = current_day.isoformat()
        day_name = current_day.strftime("%A")
        is_today = (current_day == today_date)

        day_start = datetime.combine(current_day, datetime.min.time())
        day_end = datetime.combine(current_day, datetime.max.time())

        # Filter consultations on current_day
        day_consultations: List[DaywiseConsultation] = []
        patient_ids_set = set()

        for c in all_consultations:
            if day_start <= c.scheduled_at <= day_end:
                pat = c.patient
                pat_name = f"{pat.first_name} {pat.last_name}" if pat else "Patient"
                pat_phone = pat.phone if pat else None
                doc = c.doctor
                doc_name = f"Dr. {doc.first_name} {doc.last_name}" if doc else "Doctor"

                if search:
                    term = search.lower()
                    if term not in pat_name.lower() and term not in (pat_phone or ""):
                        continue

                patient_ids_set.add(c.patient_id)
                day_consultations.append(
                    DaywiseConsultation(
                        id=c.id,
                        patient_id=c.patient_id,
                        patient_name=pat_name,
                        patient_phone=pat_phone,
                        doctor_id=c.doctor_id,
                        doctor_name=doc_name,
                        scheduled_at=c.scheduled_at,
                        consultation_type=c.consultation_type.value if hasattr(c.consultation_type, "value") else str(c.consultation_type),
                        chief_complaint=c.chief_complaint,
                        fee_paid=c.fee_paid,
                    )
                )

        # Filter therapy sessions on current_day
        day_sessions: List[DaywiseTherapySession] = []
        for s in all_sessions:
            if day_start <= s.scheduled_start <= day_end:
                # get patient from session -> plan_item -> plan -> consultation -> patient
                patient = None
                if s.plan_item and s.plan_item.plan and s.plan_item.plan.consultation:
                    patient = s.plan_item.plan.consultation.patient

                pat_id = patient.id if patient else ""
                pat_name = f"{patient.first_name} {patient.last_name}" if patient else "Patient"
                pat_phone = patient.phone if patient else None
                th_name = f"{s.therapist.first_name} {s.therapist.last_name}" if s.therapist else "Therapist"
                rm_name = s.room.name if s.room else "Room"
                tp_name = s.plan_item.therapy.name if (s.plan_item and s.plan_item.therapy) else "Therapy"

                if search:
                    term = search.lower()
                    if term not in pat_name.lower() and term not in (pat_phone or ""):
                        continue

                if pat_id:
                    patient_ids_set.add(pat_id)

                day_sessions.append(
                    DaywiseTherapySession(
                        id=s.id,
                        patient_id=pat_id,
                        patient_name=pat_name,
                        patient_phone=pat_phone,
                        therapy_name=tp_name,
                        session_number=s.session_number,
                        therapist_name=th_name,
                        room_name=rm_name,
                        scheduled_start=s.scheduled_start,
                        scheduled_end=s.scheduled_end,
                        status=s.status.value if hasattr(s.status, "value") else str(s.status),
                    )
                )

        results.append(
            DaywiseScheduleOut(
                date=day_str,
                day_name=day_name,
                is_today=is_today,
                total_unique_patients=len(patient_ids_set),
                consultations=day_consultations,
                therapy_sessions=day_sessions,
            )
        )

    return results

