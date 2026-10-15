"""Patient registration and management endpoints."""
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOrReceptionist, get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Gender, Patient, User, UserRole

router = APIRouter(prefix="/patients", tags=["Patients"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    phone: str
    email: Optional[EmailStr] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    # Optional: create a portal account
    create_portal_account: bool = False
    portal_password: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientOut(BaseModel):
    id: str
    first_name: str
    last_name: str
    phone: str
    email: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[Gender]
    address: Optional[str]
    registration_date: date
    has_portal_account: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def register_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    # Check duplicate phone
    existing = db.query(Patient).filter(Patient.phone == body.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Patient with this phone already exists")

    user_id = None
    if body.create_portal_account:
        if not body.email or not body.portal_password:
            raise HTTPException(
                status_code=400,
                detail="Email and password required for portal account",
            )
        existing_user = db.query(User).filter(User.email == body.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        portal_user = User(
            email=body.email,
            hashed_password=hash_password(body.portal_password),
            role=UserRole.patient,
        )
        db.add(portal_user)
        db.flush()
        user_id = portal_user.id

    patient = Patient(
        user_id=user_id,
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        email=body.email,
        date_of_birth=body.date_of_birth,
        gender=body.gender,
        address=body.address,
        emergency_contact_name=body.emergency_contact_name,
        emergency_contact_phone=body.emergency_contact_phone,
        allergies=body.allergies,
        medical_history=body.medical_history,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)

    return PatientOut(
        id=patient.id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        registration_date=patient.registration_date,
        has_portal_account=user_id is not None,
    )


@router.get("/", response_model=list[PatientOut])
def list_patients(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Patients can only see themselves
    if current_user.role == UserRole.patient:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        return [patient] if patient else []

    q = db.query(Patient)
    if search:
        q = q.filter(
            (Patient.first_name.ilike(f"%{search}%"))
            | (Patient.last_name.ilike(f"%{search}%"))
            | (Patient.phone.ilike(f"%{search}%"))
        )
    patients = q.offset(skip).limit(limit).all()
    return [
        PatientOut(
            id=p.id,
            first_name=p.first_name,
            last_name=p.last_name,
            phone=p.phone,
            email=p.email,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            address=p.address,
            registration_date=p.registration_date,
            has_portal_account=p.user_id is not None,
        )
        for p in patients
    ]


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Patients can only access their own record
    if current_user.role == UserRole.patient and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return PatientOut(
        id=patient.id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        registration_date=patient.registration_date,
        has_portal_account=patient.user_id is not None,
    )


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: Session = Depends(get_db),
    _: User = AdminOrReceptionist,
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return PatientOut(
        id=patient.id,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        registration_date=patient.registration_date,
        has_portal_account=patient.user_id is not None,
    )


@router.get("/me/portal")
def get_patient_portal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated patient portal summary for the logged-in patient."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        # If admin/staff is previewing, allow fallback to first patient with portal user
        if current_user.role != UserRole.patient:
            patient = db.query(Patient).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

    # Consultations
    consultations = [
        {
            "id": c.id,
            "doctor_name": f"{c.doctor.first_name} {c.doctor.last_name}" if c.doctor else "Doctor",
            "scheduled_at": c.scheduled_at,
            "chief_complaint": c.chief_complaint,
            "prakriti": c.prakriti,
            "vikriti": c.vikriti,
            "consultation_fee": float(c.consultation_fee),
            "fee_paid": c.fee_paid,
            "has_plan": c.treatment_plan is not None,
        }
        for c in patient.consultations
    ]

    # Active Treatment Plan
    active_plan = None
    all_sessions = []
    for c in patient.consultations:
        if c.treatment_plan:
            tp = c.treatment_plan
            items = []
            for item in tp.items:
                items.append({
                    "id": item.id,
                    "therapy_name": item.therapy.name if item.therapy else "Therapy",
                    "session_count": item.session_count,
                    "duration_minutes": item.duration_minutes,
                })
                for s in item.sessions:
                    all_sessions.append({
                        "id": s.id,
                        "session_number": s.session_number,
                        "therapy_name": item.therapy.name if item.therapy else "Therapy",
                        "therapist_name": f"{s.therapist.first_name} {s.therapist.last_name}" if s.therapist else "Therapist",
                        "room_name": s.room.name if s.room else "Room",
                        "scheduled_start": s.scheduled_start,
                        "scheduled_end": s.scheduled_end,
                        "status": s.status.value,
                        "observations": s.record.observations if s.record else None,
                        "feedback": s.record.patient_feedback if s.record else None,
                        "flagged_for_doctor": s.record.flagged_for_doctor if s.record else False,
                    })

            active_plan = {
                "id": tp.id,
                "title": tp.title,
                "objectives": tp.objectives,
                "diet_recommendations": tp.diet_recommendations,
                "lifestyle_recommendations": tp.lifestyle_recommendations,
                "start_date": tp.start_date,
                "end_date": tp.end_date,
                "is_finalized": tp.is_finalized,
                "items": items,
            }
            break

    # Attendance calculations (Safety and compliance rule: measures attendance, not recovery)
    total_sessions = len(all_sessions)
    completed_sessions = sum(1 for s in all_sessions if s["status"] == "completed")
    attendance_pct = round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

    # Packages & Payments
    packages = [
        {
            "id": pkg.id,
            "name": pkg.name,
            "custom_price": float(pkg.custom_price),
            "amount_paid": float(pkg.amount_paid),
            "balance_due": pkg.balance_due,
            "payment_status": pkg.payment_status.value,
            "status": pkg.status.value,
            "valid_from": pkg.valid_from,
        }
        for pkg in patient.packages
    ]

    payments = [
        {
            "id": pay.id,
            "amount": float(pay.amount),
            "method": pay.method.value,
            "receipt_number": pay.receipt.receipt_number if pay.receipt else None,
            "paid_at": pay.paid_at,
        }
        for pay in patient.payments
    ]

    return {
        "patient": {
            "id": patient.id,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "phone": patient.phone,
            "email": patient.email,
            "date_of_birth": patient.date_of_birth,
            "gender": patient.gender.value if patient.gender else None,
            "allergies": patient.allergies,
            "medical_history": patient.medical_history,
        },
        "consultations": consultations,
        "active_plan": active_plan,
        "sessions": all_sessions,
        "progress": {
            "total_sessions": total_sessions,
            "completed_sessions": completed_sessions,
            "attendance_percentage": attendance_pct,
            "attendance_label": "Session Attendance",  # Compliance requirement
        },
        "packages": packages,
        "payments": payments,
    }
