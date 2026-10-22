"""Patient registration, longitudinal EHR records, and management endpoints."""
from typing import Optional, List
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.dependencies import AdminOrReceptionist, get_current_user, require_roles, AdminOnly
from app.core.security import hash_password
from app.db.session import get_db
from app.models import Gender, Patient, User, UserRole, AuditLog, Consultation, TreatmentPlan, TherapySession

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
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientOut(BaseModel):
    id: str
    patient_number: Optional[str] = None
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    medical_history: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    registration_date: date
    has_portal_account: bool
    consultation_count: int = 0

    class Config:
        from_attributes = True


def generate_patient_number(db: Session) -> str:
    count = db.query(Patient).count()
    candidate = f"AYUR-{1001 + count}"
    while db.query(Patient).filter(Patient.patient_number == candidate).first():
        count += 1
        candidate = f"AYUR-{1001 + count}"
    return candidate


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def register_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = AdminOrReceptionist,
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
            phone=body.phone,
            hashed_password=hash_password(body.portal_password),
            role=UserRole.patient,
        )
        db.add(portal_user)
        db.flush()
        user_id = portal_user.id

    patient_num = generate_patient_number(db)
    patient = Patient(
        patient_number=patient_num,
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
    db.flush()

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_PATIENT",
        entity_type="Patient",
        entity_id=patient.id,
        detail=f"Registered patient '{patient.first_name} {patient.last_name}' (ID: {patient.patient_number}, Phone: {patient.phone})",
    )
    db.add(audit)

    db.commit()
    db.refresh(patient)

    return PatientOut(
        id=patient.id,
        patient_number=patient.patient_number,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        allergies=patient.allergies,
        medical_history=patient.medical_history,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        registration_date=patient.registration_date,
        has_portal_account=user_id is not None,
        consultation_count=0,
    )


@router.get("/", response_model=List[PatientOut])
def list_patients(
    search: Optional[str] = Query(None, description="Search by name or phone"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Patients can only see themselves
    if current_user.role == UserRole.patient:
        patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if not patient:
            return []
        return [
            PatientOut(
                id=patient.id,
                patient_number=patient.patient_number,
                first_name=patient.first_name,
                last_name=patient.last_name,
                phone=patient.phone,
                email=patient.email,
                date_of_birth=patient.date_of_birth,
                gender=patient.gender,
                address=patient.address,
                allergies=patient.allergies,
                medical_history=patient.medical_history,
                emergency_contact_name=patient.emergency_contact_name,
                emergency_contact_phone=patient.emergency_contact_phone,
                registration_date=patient.registration_date,
                has_portal_account=patient.user_id is not None,
                consultation_count=len(patient.consultations),
            )
        ]

    q = db.query(Patient)
    if search:
        search_filter = f"%{search}%"
        q = q.filter(
            (Patient.first_name.ilike(search_filter))
            | (Patient.last_name.ilike(search_filter))
            | (Patient.phone.ilike(search_filter))
            | (Patient.email.ilike(search_filter))
            | (Patient.patient_number.ilike(search_filter))
        )
    patients = q.order_by(desc(Patient.created_at)).offset(skip).limit(limit).all()
    return [
        PatientOut(
            id=p.id,
            patient_number=p.patient_number,
            first_name=p.first_name,
            last_name=p.last_name,
            phone=p.phone,
            email=p.email,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            address=p.address,
            allergies=p.allergies,
            medical_history=p.medical_history,
            emergency_contact_name=p.emergency_contact_name,
            emergency_contact_phone=p.emergency_contact_phone,
            registration_date=p.registration_date,
            has_portal_account=p.user_id is not None,
            consultation_count=len(p.consultations),
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
        patient_number=patient.patient_number,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        allergies=patient.allergies,
        medical_history=patient.medical_history,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        registration_date=patient.registration_date,
        has_portal_account=patient.user_id is not None,
        consultation_count=len(patient.consultations),
    )


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: str,
    body: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = AdminOrReceptionist,
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(patient, field, value)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_PATIENT",
        entity_type="Patient",
        entity_id=patient.id,
        detail=f"Updated details for patient '{patient.first_name} {patient.last_name}'",
    )
    db.add(audit)

    db.commit()
    db.refresh(patient)
    return PatientOut(
        id=patient.id,
        patient_number=patient.patient_number,
        first_name=patient.first_name,
        last_name=patient.last_name,
        phone=patient.phone,
        email=patient.email,
        date_of_birth=patient.date_of_birth,
        gender=patient.gender,
        address=patient.address,
        allergies=patient.allergies,
        medical_history=patient.medical_history,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        registration_date=patient.registration_date,
        has_portal_account=patient.user_id is not None,
        consultation_count=len(patient.consultations),
    )


@router.delete("/{patient_id}")
def delete_patient(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Delete a patient record. Admin only."""
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient_name = f"{patient.first_name} {patient.last_name}"
    
    # If patient has medical history / consultations, warn or prevent cascade
    if len(patient.consultations) > 0 or len(patient.packages) > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete patient with active medical history ({len(patient.consultations)} consultations on file). Records must be preserved for clinical auditing."
        )

    # If portal user exists, delete it
    if patient.user_id:
        u = db.query(User).filter(User.id == patient.user_id).first()
        if u:
            db.delete(u)

    db.delete(patient)

    audit = AuditLog(
        user_id=current_user.id,
        action="DELETE_PATIENT",
        entity_type="Patient",
        entity_id=patient_id,
        detail=f"Admin deleted patient record for '{patient_name}'",
    )
    db.add(audit)
    db.commit()

    return {"message": f"Patient '{patient_name}' deleted successfully"}


@router.get("/{patient_id}/full-history")
def get_patient_longitudinal_history(
    patient_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Comprehensive Patient 360 EHR view:
    Returns complete longitudinal history across all visits for this unique patient:
    - Demographics & medical background
    - All doctor consultations and clinical observations
    - All treatment regimens and prescribed therapies
    - All therapy sessions with therapist notes, oils used, pressure level, and status
    - Complete commercial package and payment audit trail
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == UserRole.patient and patient.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # 1. Consultations
    consultations_data = []
    treatment_plans_data = []
    all_sessions = []

    for c in patient.consultations:
        doc_name = f"Dr. {c.doctor.first_name} {c.doctor.last_name}" if c.doctor else "Doctor"
        consultations_data.append({
            "id": c.id,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "consultation_type": c.consultation_type.value if hasattr(c.consultation_type, "value") else str(c.consultation_type),
            "doctor_id": c.doctor_id,
            "doctor_name": doc_name,
            "chief_complaint": c.chief_complaint,
            "prakriti": c.prakriti,
            "vikriti": c.vikriti,
            "notes": c.notes,
            "consultation_fee": float(c.consultation_fee or 0),
            "fee_paid": c.fee_paid,
            "has_treatment_plan": c.treatment_plan is not None,
        })

        if c.treatment_plan:
            tp = c.treatment_plan
            plan_items_data = []
            for item in tp.items:
                therapy_name = item.therapy.name if item.therapy else "Therapy"
                plan_items_data.append({
                    "id": item.id,
                    "therapy_name": therapy_name,
                    "session_count": item.session_count,
                    "duration_minutes": item.duration_minutes,
                    "frequency_per_week": item.frequency_per_week,
                    "notes": item.notes,
                })
                for s in item.sessions:
                    all_sessions.append({
                        "id": s.id,
                        "session_number": s.session_number,
                        "therapy_name": therapy_name,
                        "therapist_name": f"{s.therapist.first_name} {s.therapist.last_name}" if s.therapist else "Therapist",
                        "room_name": s.room.name if s.room else "Room",
                        "scheduled_start": s.scheduled_start.isoformat() if s.scheduled_start else None,
                        "scheduled_end": s.scheduled_end.isoformat() if s.scheduled_end else None,
                        "actual_start": s.actual_start.isoformat() if s.actual_start else None,
                        "actual_end": s.actual_end.isoformat() if s.actual_end else None,
                        "status": s.status.value if hasattr(s.status, "value") else str(s.status),
                        "observations": s.record.observations if s.record else None,
                        "patient_feedback": s.record.patient_feedback if s.record else None,
                        "oils_used": s.record.oils_used if s.record else None,
                        "pressure_level": s.record.pressure_level if s.record else None,
                        "therapist_notes": s.record.therapist_notes if s.record else None,
                        "flagged_for_doctor": s.record.flagged_for_doctor if s.record else False,
                    })

            treatment_plans_data.append({
                "id": tp.id,
                "consultation_id": tp.consultation_id,
                "consultation_date": c.scheduled_at.isoformat() if c.scheduled_at else None,
                "doctor_name": doc_name,
                "title": tp.title,
                "objectives": tp.objectives,
                "diet_recommendations": tp.diet_recommendations,
                "lifestyle_recommendations": tp.lifestyle_recommendations,
                "start_date": tp.start_date.isoformat() if tp.start_date else None,
                "end_date": tp.end_date.isoformat() if tp.end_date else None,
                "is_finalized": tp.is_finalized,
                "items": plan_items_data,
            })

    # Sort consultations & sessions newest first
    consultations_data.sort(key=lambda x: x["scheduled_at"] or "", reverse=True)
    all_sessions.sort(key=lambda x: x["scheduled_start"] or "", reverse=True)

    # 2. Packages & Billing
    packages_data = []
    total_billed = 0.0
    for pkg in patient.packages:
        price = float(pkg.custom_price or 0)
        paid = float(pkg.amount_paid or 0)
        total_billed += price
        packages_data.append({
            "id": pkg.id,
            "name": pkg.name,
            "custom_price": price,
            "amount_paid": paid,
            "balance_due": float(pkg.balance_due),
            "payment_status": pkg.payment_status.value if hasattr(pkg.payment_status, "value") else str(pkg.payment_status),
            "status": pkg.status.value if hasattr(pkg.status, "value") else str(pkg.status),
            "valid_from": pkg.valid_from.isoformat() if pkg.valid_from else None,
            "valid_until": pkg.valid_until.isoformat() if pkg.valid_until else None,
        })

    payments_data = []
    total_paid = 0.0
    for pay in patient.payments:
        amt = float(pay.amount or 0)
        total_paid += amt
        payments_data.append({
            "id": pay.id,
            "amount": amt,
            "method": pay.method.value if hasattr(pay.method, "value") else str(pay.method),
            "status": "paid",
            "paid_at": pay.paid_at.isoformat() if pay.paid_at else None,
            "receipt_number": pay.receipt.receipt_number if pay.receipt else None,
        })

    # Compliance metric: Session Attendance Rate
    total_sessions_count = len(all_sessions)
    completed_sessions_count = sum(1 for s in all_sessions if s["status"] == "completed")
    attendance_rate = round((completed_sessions_count / total_sessions_count * 100), 1) if total_sessions_count > 0 else 0.0

    return {
        "patient": {
            "id": patient.id,
            "patient_number": patient.patient_number or patient.uhid or f"AYUR-{patient.id[:8].upper()}",
            "uhid": patient.patient_number or patient.uhid or f"AYUR-{patient.id[:8].upper()}",
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "phone": patient.phone,
            "email": patient.email,
            "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "gender": patient.gender.value if patient.gender else None,
            "address": patient.address,
            "emergency_contact_name": patient.emergency_contact_name,
            "emergency_contact_phone": patient.emergency_contact_phone,
            "allergies": patient.allergies,
            "medical_history": patient.medical_history,
            "registration_date": patient.registration_date.isoformat() if patient.registration_date else None,
            "has_portal_account": patient.user_id is not None,
        },
        "summary": {
            "total_visits": len(consultations_data),
            "total_treatment_plans": len(treatment_plans_data),
            "total_sessions": total_sessions_count,
            "completed_sessions": completed_sessions_count,
            "attendance_rate": attendance_rate,
            "compliance_metric_name": "Session Attendance Rate",
            "total_billed": total_billed,
            "total_paid": total_paid,
            "outstanding_balance": round(total_billed - total_paid, 2),
        },
        "consultations": consultations_data,
        "treatment_plans": treatment_plans_data,
        "therapy_sessions": all_sessions,
        "packages": packages_data,
        "payments": payments_data,
    }


@router.get("/me/portal")
def get_patient_portal_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregated patient portal summary for the logged-in patient."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        if current_user.role != UserRole.patient:
            patient = db.query(Patient).first()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

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

    total_sessions = len(all_sessions)
    completed_sessions = sum(1 for s in all_sessions if s["status"] == "completed")
    attendance_pct = round((completed_sessions / total_sessions * 100), 1) if total_sessions > 0 else 0.0

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
            "patient_number": patient.patient_number or patient.uhid or f"AYUR-{patient.id[:8].upper()}",
            "uhid": patient.patient_number or patient.uhid or f"AYUR-{patient.id[:8].upper()}",
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
            "attendance_label": "Session Attendance",
        },
        "packages": packages,
        "payments": payments,
    }
