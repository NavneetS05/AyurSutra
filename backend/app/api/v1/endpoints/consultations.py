from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
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
    treatment_plan_id: Optional[str] = None

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
                treatment_plan_id=c.treatment_plan.id if c.treatment_plan else None,
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
        treatment_plan_id=consultation.treatment_plan.id if consultation.treatment_plan else None,
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
    current_user: User = DoctorOnly,
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if not plan.items:
        raise HTTPException(status_code=400, detail="Cannot finalize plan without therapy items")

    plan.is_finalized = True
    
    from app.models import AuditLog
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="FINALIZE_TREATMENT_PLAN",
            entity_type="TreatmentPlan",
            entity_id=plan.id,
            detail=f"Finalized treatment plan '{plan.title}' with {len(plan.items)} therapy items",
        )
    )
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


@router.get("/treatment-plans/{plan_id}/summary")
def get_treatment_summary(
    plan_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    """
    Returns an aggregated Clinical Treatment Summary and Session Attendance report.
    Complies with clinical standards: completion rate measures session attendance, not clinical recovery.
    """
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    consultation = plan.consultation
    patient = consultation.patient
    doctor = consultation.doctor

    # Aggregate sessions
    all_sessions = []
    prescriptions = []
    total_planned = 0
    completed_count = 0

    for item in plan.items:
        prescriptions.append({
            "therapy_id": item.therapy_id,
            "therapy_name": item.therapy.name if item.therapy else "Therapy",
            "session_count": item.session_count,
            "duration_minutes": item.duration_minutes,
            "frequency_per_week": item.frequency_per_week,
            "notes": item.notes,
        })
        for s in item.sessions:
            total_planned += 1
            if s.status.value == "completed":
                completed_count += 1

            therapist_name = (
                f"{s.therapist.user.first_name} {s.therapist.user.last_name}"
                if s.therapist and s.therapist.user
                else "Unassigned"
            )
            room_name = s.room.name if s.room else "Unassigned"

            all_sessions.append({
                "session_id": s.id,
                "session_number": s.session_number,
                "therapy_name": item.therapy.name if item.therapy else "Therapy",
                "scheduled_at": s.scheduled_at.isoformat() if s.scheduled_at else None,
                "status": s.status.value,
                "therapist_name": therapist_name,
                "room_name": room_name,
                "actual_start": s.actual_start.isoformat() if s.actual_start else None,
                "actual_end": s.actual_end.isoformat() if s.actual_end else None,
                "observations": s.record.observations if s.record else None,
                "oils_used": s.record.oils_used if s.record else None,
                "pressure_level": s.record.pressure_level if s.record else None,
                "patient_feedback": s.record.patient_feedback if s.record else None,
                "flagged_for_doctor": s.record.flagged_for_doctor if s.record else False,
            })

    # Sort sessions chronologically
    all_sessions.sort(key=lambda x: (x["scheduled_at"] or "", x["session_number"]))

    attendance_pct = round((completed_count / total_planned * 100), 1) if total_planned > 0 else 0.0

    package_data = None
    if plan.package:
        package_data = {
            "name": plan.package.name,
            "custom_price": float(plan.package.custom_price),
            "amount_paid": float(plan.package.amount_paid),
            "balance_due": float(plan.package.balance_due),
            "payment_status": plan.package.payment_status.value,
        }

    return {
        "plan_id": plan.id,
        "title": plan.title,
        "start_date": plan.start_date.isoformat(),
        "end_date": plan.end_date.isoformat() if plan.end_date else None,
        "is_finalized": plan.is_finalized,
        "patient": {
            "id": patient.id,
            "name": f"{patient.first_name} {patient.last_name}",
            "uhid": patient.uhid,
            "phone": patient.phone,
            "email": patient.email,
            "gender": patient.gender,
            "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        },
        "doctor": {
            "id": doctor.id if doctor else None,
            "name": f"{doctor.user.first_name} {doctor.user.last_name}" if doctor and doctor.user else "Consulting Vaidya",
            "specialization": doctor.specialization if doctor else "Ayurvedic Medicine",
        },
        "clinical_assessment": {
            "chief_complaint": consultation.chief_complaint,
            "prakriti": consultation.prakriti,
            "vikriti": consultation.vikriti,
            "notes": consultation.notes,
        },
        "prescriptions": prescriptions,
        "attendance": {
            "total_planned_sessions": total_planned,
            "completed_sessions": completed_count,
            "session_attendance_percentage": attendance_pct,
            "compliance_notice": "Measures session attendance, not clinical recovery.",
        },
        "sessions": all_sessions,
        "diet_recommendations": plan.diet_recommendations,
        "lifestyle_recommendations": plan.lifestyle_recommendations,
        "package_billing": package_data,
    }


@router.get("/treatment-plans/{plan_id}/summary/pdf")
def get_treatment_summary_pdf(
    plan_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    """
    Renders an official, printable Clinical Treatment Summary & Panchakarma Discharge Report.
    """
    data = get_treatment_summary(plan_id=plan_id, db=db, _=_)
    patient = data["patient"]
    doctor = data["doctor"]
    assessment = data["clinical_assessment"]
    attendance = data["attendance"]
    prescriptions = data["prescriptions"]
    sessions = data["sessions"]

    session_rows = "".join([
        f"""
        <tr>
            <td>#{s['session_number']} - {s['therapy_name']}</td>
            <td>{s['scheduled_at'][:10] if s['scheduled_at'] else '—'}</td>
            <td>{s['therapist_name']}</td>
            <td><strong>{s['status'].upper()}</strong></td>
            <td>{s['observations'] or s['oils_used'] or '—'}</td>
        </tr>
        """
        for s in sessions
    ])

    prescription_rows = "".join([
        f"""
        <li><strong>{p['therapy_name']}</strong>: {p['session_count']} sessions ({p['duration_minutes']} mins each)</li>
        """
        for p in prescriptions
    ])

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Treatment Summary - {patient['name']}</title>
        <style>
            body {{ font-family: 'Helvetica Neue', Arial, sans-serif; padding: 35px; color: #2d3748; line-height: 1.5; }}
            .clinic-header {{ border-bottom: 2px solid #556b2f; padding-bottom: 15px; margin-bottom: 25px; }}
            .clinic-name {{ font-size: 24px; font-weight: bold; color: #3b4d24; }}
            .report-title {{ font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; color: #718096; margin-top: 4px; }}
            .grid {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
            .col {{ width: 48%; background: #f7fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }}
            .col h4 {{ margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; color: #4a5568; border-bottom: 1px solid #edf2f7; padding-bottom: 4px; }}
            .col p {{ margin: 4px 0; font-size: 13px; }}
            .dosha-tag {{ display: inline-block; padding: 2px 8px; background: #e6fffa; color: #234e52; border-radius: 4px; font-weight: bold; font-size: 12px; }}
            .section {{ margin-top: 25px; }}
            .section-title {{ font-size: 15px; font-weight: bold; color: #2d3748; border-bottom: 1px solid #cbd5e0; padding-bottom: 5px; margin-bottom: 10px; }}
            .attendance-box {{ background: #f0fff4; border: 1px solid #c6f6d5; padding: 12px 16px; border-radius: 8px; margin-bottom: 15px; }}
            .attendance-rate {{ font-size: 22px; font-weight: bold; color: #22543d; }}
            .compliance-note {{ font-size: 11px; color: #718096; font-style: italic; margin-top: 4px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }}
            th {{ background: #edf2f7; text-align: left; padding: 8px 10px; border-bottom: 2px solid #cbd5e0; }}
            td {{ padding: 8px 10px; border-bottom: 1px solid #e2e8f0; }}
            .rx-box {{ background: #fffaf0; border: 1px solid #feebc8; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 15px; }}
            .sign-area {{ margin-top: 50px; display: flex; justify-content: space-between; }}
            .sign-box {{ width: 220px; border-top: 1px dashed #a0aec0; text-align: center; padding-top: 8px; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="clinic-header">
            <div class="clinic-name">{settings.CLINIC_NAME}</div>
            <div class="report-title">Panchakarma Clinical Discharge & Treatment Summary</div>
        </div>

        <div class="grid">
            <div class="col">
                <h4>Patient Demographics</h4>
                <p><strong>Name:</strong> {patient['name']}</p>
                <p><strong>UHID:</strong> {patient['uhid']}</p>
                <p><strong>Contact:</strong> {patient['phone']}</p>
                <p><strong>Gender:</strong> {patient['gender'].capitalize()}</p>
            </div>
            <div class="col">
                <h4>Clinical Assessment</h4>
                <p><strong>Consulting Vaidya:</strong> Dr. {doctor['name']}</p>
                <p><strong>Prakriti / Vikriti:</strong> <span class="dosha-tag">{assessment['prakriti'] or 'Pitta-Kapha'}</span> / <span class="dosha-tag">{assessment['vikriti'] or 'Vata'}</span></p>
                <p><strong>Chief Complaint:</strong> {assessment['chief_complaint'] or 'Chronic Stress & Musculoskeletal Fatigue'}</p>
            </div>
        </div>

        <div class="attendance-box">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <span style="font-size: 13px; font-weight: bold; color: #276749;">Session Attendance Progress</span>
                    <div class="compliance-note">* {attendance['compliance_notice']}</div>
                </div>
                <div class="attendance-rate">{attendance['session_attendance_percentage']}%</div>
            </div>
            <p style="margin: 6px 0 0 0; font-size: 12px; color: #2f855a;">
                Completed {attendance['completed_sessions']} of {attendance['total_planned_sessions']} planned therapeutic sessions.
            </p>
        </div>

        <div class="section">
            <div class="section-title">Prescribed Panchakarma Protocol: {data['title']}</div>
            <ul style="margin: 6px 0 0 20px; font-size: 13px;">
                {prescription_rows}
            </ul>
        </div>

        <div class="section">
            <div class="section-title">Therapy Session Log & Clinical Observations</div>
            <table>
                <thead>
                    <tr>
                        <th>Procedure</th>
                        <th>Date</th>
                        <th>Therapist</th>
                        <th>Status</th>
                        <th>Clinical Observations / Oils</th>
                    </tr>
                </thead>
                <tbody>
                    {session_rows or '<tr><td colspan="5" style="text-align:center;">No sessions scheduled yet.</td></tr>'}
                </tbody>
            </table>
        </div>

        <div class="rx-box">
            <h4 style="margin: 0 0 6px 0; font-size: 13px; color: #744210;">Discharge Care Protocol (Pathya & Vihara)</h4>
            <p><strong>Dietary Protocol (Pathya):</strong> {data['diet_recommendations'] or 'Warm, light meals; avoid deep-fried foods, cold beverages, and curd at night.'}</p>
            <p><strong>Lifestyle Protocol (Vihara):</strong> {data['lifestyle_recommendations'] or 'Early sleeping before 10 PM; gentle morning pranayama; avoid heavy exertion for 7 days post-treatment.'}</p>
        </div>

        <div class="sign-area">
            <div class="sign-box">
                Patient / Guardian Signature
            </div>
            <div class="sign-box">
                Authorized Ayurvedic Physician
            </div>
        </div>
    </body>
    </html>
    """

    try:
        from weasyprint import HTML
        pdf_bytes = HTML(string=html_content).write_pdf()
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=Treatment_Summary_{patient['uhid']}.pdf"},
        )
    except Exception:
        # Graceful fallback to HTML print layout
        return Response(content=html_content, media_type="text/html")
