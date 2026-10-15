from datetime import date, datetime
from decimal import Decimal
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import AdminOrReceptionist, AnyRole
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
    _: User = AdminOrReceptionist,
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
    _: User = AdminOrReceptionist,
):
    patient = db.query(Patient).filter(Patient.id == body.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

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
def generate_receipt_pdf(
    receipt_number: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    receipt = db.query(Receipt).filter(Receipt.receipt_number == receipt_number).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    payment = receipt.payment
    patient = payment.patient

    # Generate clean HTML receipt
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Receipt {receipt.receipt_number}</title>
        <style>
            body {{ font-family: 'Helvetica', Arial, sans-serif; padding: 40px; color: #333; }}
            .header {{ border-bottom: 2px solid #6b7f5e; padding-bottom: 20px; margin-bottom: 30px; }}
            .title {{ font-size: 24px; font-weight: bold; color: #4a5c40; }}
            .sub {{ font-size: 13px; color: #666; }}
            .grid {{ display: flex; justify-content: space-between; margin-bottom: 30px; }}
            .box {{ width: 48%; }}
            .box h4 {{ margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; color: #888; }}
            .box p {{ margin: 3px 0; font-size: 14px; }}
            table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
            th {{ background: #f5f4f0; text-align: left; padding: 10px; font-size: 13px; border-bottom: 1px solid #ddd; }}
            td {{ padding: 12px 10px; font-size: 14px; border-bottom: 1px solid #eee; }}
            .total-row td {{ font-weight: bold; font-size: 16px; border-top: 2px solid #4a5c40; }}
            .footer {{ margin-top: 50px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="title">{settings.CLINIC_NAME}</div>
            <div class="sub">Official Payment Receipt & Slip</div>
        </div>
        <div class="grid">
            <div class="box">
                <h4>Receipt Details</h4>
                <p><strong>Receipt #:</strong> {receipt.receipt_number}</p>
                <p><strong>Date:</strong> {payment.paid_at.strftime('%d %B %Y, %I:%M %p')}</p>
                <p><strong>Payment Method:</strong> {payment.method.value.upper()}</p>
                {f'<p><strong>Reference:</strong> {payment.reference_number}</p>' if payment.reference_number else ''}
            </div>
            <div class="box">
                <h4>Billed To</h4>
                <p><strong>Patient:</strong> {patient.first_name} {patient.last_name}</p>
                <p><strong>Phone:</strong> {patient.phone}</p>
                {f'<p><strong>Email:</strong> {patient.email}</p>' if patient.email else ''}
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th style="text-align: right;">Amount (INR)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>{'Therapy Package Payment' if payment.package_id else 'Doctor Consultation Fee'}</td>
                    <td style="text-align: right;">₹{float(payment.amount):,.2f}</td>
                </tr>
                <tr class="total-row">
                    <td>Total Paid</td>
                    <td style="text-align: right;">₹{float(payment.amount):,.2f}</td>
                </tr>
            </tbody>
        </table>
        <div class="footer">
            Thank you for choosing {settings.CLINIC_NAME}. May health and vitality be with you.
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
            headers={"Content-Disposition": f"attachment; filename={receipt.receipt_number}.pdf"},
        )
    except Exception:
        # Fallback to returning HTML for printing if WeasyPrint OS library has DLL dependencies on Windows
        return Response(content=html_content, media_type="text/html")
