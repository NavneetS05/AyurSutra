from datetime import date, datetime
from decimal import Decimal
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import AdminOrReceptionist, DoctorAdminOrReceptionist, AnyRole, AnyRoleFlexible
from app.services.pdf_generator import generate_receipt_pdf as build_receipt_pdf
from app.db.session import get_db
from app.models import (
    Consultation,
    PackageStatus,
    Patient,
    PatientPackage,
    Payment,
    PaymentMethod,
    PaymentStatus,
    Receipt,
    TreatmentPlan,
    User,
)

router = APIRouter(prefix="/billing", tags=["Billing & Packages"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class PackageCreate(BaseModel):
    treatment_plan_id: str
    name: str
    custom_price: Decimal  # Per key differentiator: doctor/admin custom price
    valid_from: date
    valid_until: Optional[date] = None


class PackageOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    treatment_plan_id: str
    name: str
    custom_price: Decimal
    amount_paid: Decimal
    balance_due: float
    payment_status: PaymentStatus
    status: PackageStatus
    valid_from: date
    valid_until: Optional[date] = None

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    patient_id: str
    amount: Decimal
    method: PaymentMethod
    package_id: Optional[str] = None
    consultation_id: Optional[str] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    patient_id: str
    amount: Decimal
    method: PaymentMethod
    package_id: Optional[str] = None
    consultation_id: Optional[str] = None
    reference_number: Optional[str] = None
    receipt_number: Optional[str] = None
    paid_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/packages", response_model=PackageOut, status_code=status.HTTP_201_CREATED)
def create_package(
    body: PackageCreate,
    db: Session = Depends(get_db),
    current_user: User = DoctorAdminOrReceptionist,
):
    plan = db.query(TreatmentPlan).filter(TreatmentPlan.id == body.treatment_plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if plan.package:
        raise HTTPException(status_code=400, detail="Package already created for this treatment plan")

    patient = plan.consultation.patient
    package = PatientPackage(
        patient_id=patient.id,
        treatment_plan_id=plan.id,
        name=body.name,
        custom_price=body.custom_price,
        amount_paid=Decimal("0.00"),
        payment_status=PaymentStatus.pending,
        status=PackageStatus.active,
        valid_from=body.valid_from,
        valid_until=body.valid_until,
    )
    db.add(package)
    db.flush()
    
    from app.models import AuditLog
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="CREATE_PATIENT_PACKAGE",
            entity_type="PatientPackage",
            entity_id=package.id,
            detail=f"Created custom package '{package.name}' for INR {package.custom_price}",
        )
    )
    db.commit()
    db.refresh(package)

    return PackageOut(
        id=package.id,
        patient_id=patient.id,
        patient_name=f"{patient.first_name} {patient.last_name}",
        treatment_plan_id=package.treatment_plan_id,
        name=package.name,
        custom_price=package.custom_price,
        amount_paid=package.amount_paid,
        balance_due=package.balance_due,
        payment_status=package.payment_status,
        status=package.status,
        valid_from=package.valid_from,
        valid_until=package.valid_until,
    )


@router.get("/packages/{package_id}", response_model=PackageOut)
def get_package(
    package_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    package = db.query(PatientPackage).filter(PatientPackage.id == package_id).first()
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")

    p = package.patient
    return PackageOut(
        id=package.id,
        patient_id=package.patient_id,
        patient_name=f"{p.first_name} {p.last_name}" if p else "Patient",
        treatment_plan_id=package.treatment_plan_id,
        name=package.name,
        custom_price=package.custom_price,
        amount_paid=package.amount_paid,
        balance_due=package.balance_due,
        payment_status=package.payment_status,
        status=package.status,
        valid_from=package.valid_from,
        valid_until=package.valid_until,
    )


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = AdminOrReceptionist,
):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if body.method != PaymentMethod.cash:
        raise HTTPException(
            status_code=400,
            detail=f"{body.method.value.upper()} payment method is coming soon. Only Cash payment is currently accepted at Front Desk.",
        )

    if not body.package_id and not body.consultation_id:
        raise HTTPException(status_code=400, detail="Must associate payment with a package or consultation")

    payment = Payment(
        patient_id=body.patient_id,
        package_id=body.package_id,
        consultation_id=body.consultation_id,
        amount=body.amount,
        method=body.method,
        reference_number=body.reference_number,
        notes=body.notes,
    )
    db.add(payment)
    db.flush()

    # Generate receipt record
    receipt_no = f"REC-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    receipt = Receipt(
        payment_id=payment.id,
        receipt_number=receipt_no,
    )
    db.add(receipt)

    # Update package amount paid if applicable
    if body.package_id:
        pkg = db.query(PatientPackage).filter(PatientPackage.id == body.package_id).first()
        if pkg:
            pkg.amount_paid += body.amount
            if pkg.amount_paid >= pkg.custom_price:
                pkg.payment_status = PaymentStatus.paid
            else:
                pkg.payment_status = PaymentStatus.partial

    # Update consultation fee paid if applicable
    if body.consultation_id:
        c = db.query(Consultation).filter(Consultation.id == body.consultation_id).first()
        if c:
            c.fee_paid = True

    from app.models import AuditLog
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="RECORD_PAYMENT",
            entity_type="Payment",
            entity_id=payment.id,
            detail=f"Collected payment of INR {payment.amount} via {payment.method.value}. Receipt: {receipt.receipt_number}",
        )
    )

    db.commit()
    db.refresh(payment)

    return PaymentOut(
        id=payment.id,
        patient_id=payment.patient_id,
        amount=payment.amount,
        method=payment.method,
        package_id=payment.package_id,
        consultation_id=payment.consultation_id,
        reference_number=payment.reference_number,
        receipt_number=receipt.receipt_number,
        paid_at=payment.paid_at,
    )


@router.get("/receipts/{receipt_number}/pdf")
def generate_receipt_pdf_endpoint(
    receipt_number: str,
    db: Session = Depends(get_db),
    _: User = AnyRoleFlexible,
):
    receipt = db.query(Receipt).filter(Receipt.receipt_number == receipt_number).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    payment = receipt.payment
    patient = payment.patient

    description = "Doctor Consultation Fee"
    if payment.package_id:
        pkg = db.query(PatientPackage).filter(PatientPackage.id == payment.package_id).first()
        description = f"Therapy Package Payment ({pkg.name})" if pkg else "Therapy Package Payment"

    pdf_bytes = build_receipt_pdf(
        receipt_number=receipt.receipt_number,
        paid_at=payment.paid_at,
        method=payment.method.value if payment.method else "cash",
        amount=float(payment.amount),
        reference_number=payment.reference_number,
        patient_name=f"{patient.first_name} {patient.last_name}" if patient else "Valued Patient",
        patient_number=patient.patient_number or patient.uhid if patient else None,
        patient_phone=patient.phone if patient else None,
        patient_email=patient.email if patient else None,
        description=description,
        clinic_name=settings.CLINIC_NAME,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="Receipt_{receipt.receipt_number}.pdf"',
            "Content-Type": "application/pdf",
        },
    )
