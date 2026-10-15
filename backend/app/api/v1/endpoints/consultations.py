from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOrReceptionist, DoctorOnly, StaffOnly, AnyRole
from app.db.session import get_db
from app.models import (
    Consultation,
    ConsultationType,
    Patient,
    Staff,
    TreatmentPlan,
    TreatmentPlanItem,
    User,
    UserRole,
)

router = APIRouter(prefix="/consultations", tags=["Consultations & Treatment Plans"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ConsultationCreate(BaseModel):
    patient_id: str
    doctor_id: str
    scheduled_at: datetime
    consultation_type: ConsultationType = ConsultationType.initial
    consultation_fee: Decimal = Decimal("500.00")
    chief_complaint: Optional[str] = None


class ConsultationNotesUpdate(BaseModel):
    notes: Optional[str] = None
    chief_complaint: Optional[str] = None
    prakriti: Optional[str] = None  # Vata, Pitta, Kapha, or combinations
    vikriti: Optional[str] = None
    fee_paid: Optional[bool] = None


class PlanItemIn(BaseModel):
    therapy_id: str
    session_count: int = 1
    duration_minutes: int = 60
    frequency_per_week: Optional[int] = None
    notes: Optional[str] = None


class TreatmentPlanCreate(BaseModel):
    title: str
    objectives: Optional[str] = None
    diet_recommendations: Optional[str] = None
    lifestyle_recommendations: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    items: list[PlanItemIn]


class PlanItemOut(BaseModel):
    id: str
    therapy_id: str
    therapy_name: Optional[str] = None
    session_count: int
    duration_minutes: int
    frequency_per_week: Optional[int] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class TreatmentPlanOut(BaseModel):
    id: str
    consultation_id: str
    title: str
    objectives: Optional[str] = None
    diet_recommendations: Optional[str] = None
    lifestyle_recommendations: Optional[str] = None
    start_date: date
    end_date: Optional[date] = None
    is_finalized: bool
    items: list[PlanItemOut] = []

    class Config:
        from_attributes = True


class ConsultationOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    doctor_name: str
    consultation_type: ConsultationType
    scheduled_at: datetime
    notes: Optional[str] = None
    chief_complaint: Optional[str] = None
    prakriti: Optional[str] = None
    vikriti: Optional[str] = None
    consultation_fee: Decimal
    fee_paid: bool
    has_treatment_plan: bool = False

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=ConsultationOut, status_code=status.HTTP_201_CREATED)
def book_consultation(
    body: ConsultationCreate,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor = db.query(Staff).filter(Staff.id == body.doctor_id, Staff.is_doctor == True).first()  # noqa: E712
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    consultation = Consultation(
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        scheduled_at=body.scheduled_at,
        consultation_type=body.consultation_type,
        consultation_fee=body.consultation_fee,
        chief_complaint=body.chief_complaint,
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    return ConsultationOut(
        id=consultation.id,
        patient_id=patient.id,
        patient_name=f"{patient.first_name} {patient.last_name}",
        doctor_id=doctor.id,
        doctor_name=f"{doctor.first_name} {doctor.last_name}",
        consultation_type=consultation.consultation_type,
        scheduled_at=consultation.scheduled_at,
        notes=consultation.notes,
        chief_complaint=consultation.chief_complaint,
        prakriti=consultation.prakriti,
        vikriti=consultation.vikriti,
        consultation_fee=consultation.consultation_fee,
        fee_paid=consultation.fee_paid,
        has_treatment_plan=False,
    )


@router.get("/", response_model=list[ConsultationOut])
def list_consultations(
    patient_id: Optional[str] = None,
    doctor_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = AnyRole,
):
    query = db.query(Consultation)

    if current_user.role == UserRole.patient:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        query = query.filter(Consultation.patient_id == patient.id)
    elif current_user.role == UserRole.doctor:
        staff = current_user.staff_profile
        if staff:
            query = query.filter(Consultation.doctor_id == staff.id)
    else:
        if patient_id:
            query = query.filter(Consultation.patient_id == patient_id)
        if doctor_id:
            query = query.filter(Consultation.doctor_id == doctor_id)

    consultations = query.order_by(Consultation.scheduled_at.desc()).all()
    results = []
    for c in consultations:
        results.append(
            ConsultationOut(
                id=c.id,
                patient_id=c.patient.id if c.patient else "",
                patient_name=f"{c.patient.first_name} {c.patient.last_name}" if c.patient else "Unknown",
                doctor_id=c.doctor.id if c.doctor else "",
                doctor_name=f"{c.doctor.first_name} {c.doctor.last_name}" if c.doctor else "Unknown",
                consultation_type=c.consultation_type,
                scheduled_at=c.scheduled_at,
                notes=c.notes,
                chief_complaint=c.chief_complaint,
                prakriti=c.prakriti,
                vikriti=c.vikriti,
                consultation_fee=c.consultation_fee,
                fee_paid=c.fee_paid,
                has_treatment_plan=c.treatment_plan is not None,
            )
        )
    return results


@router.patch("/{consultation_id}/notes", response_model=ConsultationOut)
def update_consultation_notes(
    consultation_id: str,
    body: ConsultationNotesUpdate,
    db: Session = Depends(get_db),
    _: User = DoctorOnly,
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(consultation, field, val)

    db.commit()
    db.refresh(consultation)

    return ConsultationOut(
        id=consultation.id,
        patient_id=consultation.patient.id if consultation.patient else "",
        patient_name=f"{consultation.patient.first_name} {consultation.patient.last_name}" if consultation.patient else "",
        doctor_id=consultation.doctor.id if consultation.doctor else "",
        doctor_name=f"{consultation.doctor.first_name} {consultation.doctor.last_name}" if consultation.doctor else "",
        consultation_type=consultation.consultation_type,
        scheduled_at=consultation.scheduled_at,
        notes=consultation.notes,
        chief_complaint=consultation.chief_complaint,
        prakriti=consultation.prakriti,
        vikriti=consultation.vikriti,
        consultation_fee=consultation.consultation_fee,
        fee_paid=consultation.fee_paid,
        has_treatment_plan=consultation.treatment_plan is not None,
    )


@router.post("/{consultation_id}/treatment-plan", response_model=TreatmentPlanOut)
def create_treatment_plan(
    consultation_id: str,
    body: TreatmentPlanCreate,
    db: Session = Depends(get_db),
    _: User = DoctorOnly,
):
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    if consultation.treatment_plan:
        raise HTTPException(status_code=400, detail="Treatment plan already exists for this consultation")

    plan = TreatmentPlan(
        consultation_id=consultation_id,
        title=body.title,
        objectives=body.objectives,
        diet_recommendations=body.diet_recommendations,
        lifestyle_recommendations=body.lifestyle_recommendations,
        start_date=body.start_date,
        end_date=body.end_date,
        is_finalized=False,
    )
    db.add(plan)
    db.flush()

    items = []
    for item in body.items:
        plan_item = TreatmentPlanItem(
            plan_id=plan.id,
            therapy_id=item.therapy_id,
            session_count=item.session_count,
            duration_minutes=item.duration_minutes,
            frequency_per_week=item.frequency_per_week,
            notes=item.notes,
        )
        db.add(plan_item)
        items.append(plan_item)

    db.commit()
    db.refresh(plan)

    return TreatmentPlanOut(
        id=plan.id,
        consultation_id=plan.consultation_id,
        title=plan.title,
        objectives=plan.objectives,
        diet_recommendations=plan.diet_recommendations,
        lifestyle_recommendations=plan.lifestyle_recommendations,
        start_date=plan.start_date,
        end_date=plan.end_date,
        is_finalized=plan.is_finalized,
        items=[
            PlanItemOut(
                id=pi.id,
                therapy_id=pi.therapy_id,
                therapy_name=pi.therapy.name if pi.therapy else "Therapy",
                session_count=pi.session_count,
                duration_minutes=pi.duration_minutes,
                frequency_per_week=pi.frequency_per_week,
                notes=pi.notes,
            )
            for pi in plan.items
        ],
    )


@router.post("/treatment-plans/{plan_id}/finalize", response_model=TreatmentPlanOut)
def finalize_treatment_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    _: User = DoctorOnly,
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if not plan.items:
        raise HTTPException(status_code=400, detail="Cannot finalize plan without therapy items")

    plan.is_finalized = True
    db.commit()
    db.refresh(plan)

    return TreatmentPlanOut(
        id=plan.id,
        consultation_id=plan.consultation_id,
        title=plan.title,
        objectives=plan.objectives,
        diet_recommendations=plan.diet_recommendations,
        lifestyle_recommendations=plan.lifestyle_recommendations,
        start_date=plan.start_date,
        end_date=plan.end_date,
        is_finalized=plan.is_finalized,
        items=[
            PlanItemOut(
                id=pi.id,
                therapy_id=pi.therapy_id,
                therapy_name=pi.therapy.name if pi.therapy else "",
                session_count=pi.session_count,
                duration_minutes=pi.duration_minutes,
                frequency_per_week=pi.frequency_per_week,
                notes=pi.notes,
            )
            for pi in plan.items
        ],
    )


@router.get("/treatment-plans/{plan_id}", response_model=TreatmentPlanOut)
def get_treatment_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    return TreatmentPlanOut(
        id=plan.id,
        consultation_id=plan.consultation_id,
        title=plan.title,
        objectives=plan.objectives,
        diet_recommendations=plan.diet_recommendations,
        lifestyle_recommendations=plan.lifestyle_recommendations,
        start_date=plan.start_date,
        end_date=plan.end_date,
        is_finalized=plan.is_finalized,
        items=[
            PlanItemOut(
                id=pi.id,
                therapy_id=pi.therapy_id,
                therapy_name=pi.therapy.name if pi.therapy else "",
                session_count=pi.session_count,
                duration_minutes=pi.duration_minutes,
                frequency_per_week=pi.frequency_per_week,
                notes=pi.notes,
            )
            for pi in plan.items
        ],
    )
