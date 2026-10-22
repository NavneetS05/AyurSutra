import pytest
from app.models import Patient, TreatmentPlan, TreatmentPlanItem, Therapy, Room, Staff, User, UserRole, Payment, Receipt, PaymentMethod
from app.core.security import create_access_token


def test_unique_patient_number_and_pdf_downloads(client, admin_headers, db):
    # 1. Register a new patient and verify sequential unique patient number
    reg_payload = {
        "first_name": "Divya",
        "last_name": "Nair",
        "phone": "+91 99887 76655",
        "email": "divya.nair@example.com",
        "gender": "female",
        "address": "Kochi, Kerala",
    }
    res = client.post("/api/v1/patients/", json=reg_payload, headers=admin_headers)
    assert res.status_code == 201, res.text
    new_pat = res.json()
    assert "patient_number" in new_pat
    assert new_pat["patient_number"].startswith("AYUR-")

    # 2. Check patient list includes patient_number
    list_res = client.get("/api/v1/patients/", headers=admin_headers)
    assert list_res.status_code == 200
    patients = list_res.json()
    found = next((p for p in patients if p["id"] == new_pat["id"]), None)
    assert found is not None
    assert found["patient_number"] == new_pat["patient_number"]

    # 3. Create a consultation & payment to generate a receipt
    doctor_staff = db.query(Staff).filter(Staff.is_doctor == True).first()
    if not doctor_staff:
        doc_user = User(
            email="doc_test_pdf@ayursutra.com",
            hashed_password="hashedpassword123",
            role=UserRole.doctor,
            is_active=True,
            is_online=True,
        )
        db.add(doc_user)
        db.flush()
        doctor_staff = Staff(
            user_id=doc_user.id,
            first_name="Anand",
            last_name="Sharma",
            specialization="Kayachikitsa",
            qualification="BAMS",
            is_doctor=True,
            is_therapist=False,
        )
        db.add(doctor_staff)
        db.commit()
        db.refresh(doctor_staff)

    consult_res = client.post(
        "/api/v1/consultations/",
        json={
            "patient_id": new_pat["id"],
            "doctor_id": doctor_staff.id,
            "scheduled_at": "2026-10-25T10:00:00",
            "consultation_type": "initial",
            "consultation_fee": 500.0,
            "collect_payment": True,
            "payment_method": "cash",
        },
        headers=admin_headers,
    )
    assert consult_res.status_code == 201, consult_res.text
    consult_data = consult_res.json()
    assert consult_data["patient_number"] == new_pat["patient_number"]

    # Find the receipt for this payment
    receipt = db.query(Receipt).first()
    assert receipt is not None
    receipt_no = receipt.receipt_number

    # 4. Download Receipt PDF using Bearer Auth Header
    receipt_res = client.get(f"/api/v1/billing/receipts/{receipt_no}/pdf", headers=admin_headers)
    assert receipt_res.status_code == 200, receipt_res.text
    assert receipt_res.headers["content-type"] == "application/pdf"
    assert receipt_res.content.startswith(b"%PDF-"), "Should return genuine PDF binary"

    # 5. Download Receipt PDF using query token (simulating direct browser link / window.open)
    raw_token = admin_headers["Authorization"].replace("Bearer ", "")
    receipt_token_res = client.get(f"/api/v1/billing/receipts/{receipt_no}/pdf?token={raw_token}")
    assert receipt_token_res.status_code == 200, receipt_token_res.text
    assert receipt_token_res.headers["content-type"] == "application/pdf"
    assert receipt_token_res.content.startswith(b"%PDF-")

    # 6. Create treatment plan and test Treatment Summary PDF download
    therapy = db.query(Therapy).filter(Therapy.name == "PDF Protocol Therapy").first()
    if not therapy:
        therapy = Therapy(
            name="PDF Protocol Therapy",
            category="poorva_karma",
            default_duration_minutes=45,
            suggested_price=1200.0,
            is_active=True,
        )
        db.add(therapy)
        db.commit()
        db.refresh(therapy)

    doc_token = create_access_token(subject=doctor_staff.user_id, role="doctor")
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    plan_res = client.post(
        f"/api/v1/consultations/{consult_data['id']}/treatment-plan",
        json={
            "title": "Comprehensive Panchakarma Protocol",
            "objectives": "Detoxification & stress relief",
            "start_date": "2026-10-26",
            "items": [
                {
                    "therapy_id": therapy.id,
                    "session_count": 5,
                    "duration_minutes": 60,
                    "frequency_per_week": 5,
                    "notes": "Therapeutic sesame oil",
                }
            ],
        },
        headers=doc_headers,
    )
    assert plan_res.status_code in (200, 201), plan_res.text
    plan_id = plan_res.json()["id"]

    # Download summary PDF via Bearer Auth Header
    summary_res = client.get(f"/api/v1/consultations/treatment-plans/{plan_id}/summary/pdf", headers=admin_headers)
    assert summary_res.status_code == 200, summary_res.text
    assert summary_res.headers["content-type"] == "application/pdf"
    assert summary_res.content.startswith(b"%PDF-"), "Should return genuine PDF binary"

    # Download summary PDF via query token
    summary_token_res = client.get(f"/api/v1/consultations/treatment-plans/{plan_id}/summary/pdf?token={raw_token}")
    assert summary_token_res.status_code == 200, summary_token_res.text
    assert summary_token_res.headers["content-type"] == "application/pdf"
    assert summary_token_res.content.startswith(b"%PDF-")
