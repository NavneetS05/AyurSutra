"""End-to-end integration test of the AyurSutra workflow:
Registration -> Consultation -> Plan -> Custom Package -> Scheduling -> Session Completion -> Patient Portal
"""
from datetime import date, datetime, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.security import create_access_token
from app.db.session import Base, get_db
from app.main import app
from app.models import (
    Consultation,
    ConsultationType,
    Gender,
    Patient,
    Room,
    Staff,
    StaffAvailability,
    TherapistTherapy,
    Therapy,
    User,
    UserRole,
)

from sqlalchemy.pool import StaticPool

from tests.conftest import TestSessionLocal, test_engine

TestingSessionLocal = TestSessionLocal
engine = test_engine


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create admin
    admin = User(email="admin@test.com", hashed_password="pw", role=UserRole.admin)
    db.add(admin)

    # Create doctor
    doc_user = User(email="doc@test.com", hashed_password="pw", role=UserRole.doctor)
    db.add(doc_user)
    db.flush()
    doc_staff = Staff(user_id=doc_user.id, first_name="Vaidya", last_name="Sharma", is_doctor=True)
    db.add(doc_staff)

    # Create therapist
    th_user = User(email="therapist@test.com", hashed_password="pw", role=UserRole.therapist)
    db.add(th_user)
    db.flush()
    th_staff = Staff(user_id=th_user.id, first_name="Therapist", last_name="One", is_therapist=True)
    db.add(th_staff)
    db.flush()

    from datetime import time as dt_time

    # Therapist availability (all weekdays, 08:00 - 18:00)
    for w in range(7):
        db.add(
            StaffAvailability(
                staff_id=th_staff.id,
                weekday=w,
                start_time=dt_time(8, 0),
                end_time=dt_time(18, 0),
            )
        )

    # Create therapy & room
    therapy = Therapy(name="Abhyanga", default_duration_minutes=60, suggested_price=Decimal("1500"))
    db.add(therapy)
    db.flush()

    room = Room(name="Dhanvantari", capacity=1)
    db.add(room)

    # Authorize therapist
    db.add(TherapistTherapy(staff_id=th_staff.id, therapy_id=therapy.id))

    db.commit()
    db.close()

    yield

    # Clean records without dropping schema
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


def get_token(user_id: str, role: str) -> dict:
    token = create_access_token(subject=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}


def test_full_patient_and_scheduling_lifecycle(client):
    db = TestingSessionLocal()
    admin_u = db.query(User).filter(User.email == "admin@test.com").first()
    doc_u = db.query(User).filter(User.email == "doc@test.com").first()
    th_u = db.query(User).filter(User.email == "therapist@test.com").first()
    doc_id = db.query(Staff).filter(Staff.is_doctor == True).first().id
    therapy_id = db.query(Therapy).first().id
    admin_uid = admin_u.id
    doc_uid = doc_u.id
    th_uid = th_u.id
    db.close()

    # 1. Register Patient with portal account
    admin_hdr = get_token(admin_uid, "admin")
    reg_resp = client.post(
        "/api/v1/patients/",
        json={
            "first_name": "Rohan",
            "last_name": "Mehta",
            "phone": "9998887770",
            "email": "rohan@test.com",
            "gender": "male",
            "create_portal_account": True,
            "portal_password": "Password@123",
        },
        headers=admin_hdr,
    )
    assert reg_resp.status_code == 201
    patient_id = reg_resp.json()["id"]

    # 2. Book Consultation
    consult_resp = client.post(
        "/api/v1/consultations/",
        json={
            "patient_id": patient_id,
            "doctor_id": doc_id,
            "scheduled_at": datetime.utcnow().isoformat(),
            "consultation_type": "initial",
            "consultation_fee": 500,
            "chief_complaint": "Joint pain and stress",
        },
        headers=admin_hdr,
    )
    assert consult_resp.status_code == 201
    consult_id = consult_resp.json()["id"]

    # 3. Doctor notes & Treatment plan creation
    doc_hdr = get_token(doc_uid, "doctor")
    plan_resp = client.post(
        f"/api/v1/consultations/{consult_id}/treatment-plan",
        json={
            "title": "Vata Balancing Protocol",
            "objectives": "Pain relief & relaxation",
            "diet_recommendations": "Warm foods only",
            "lifestyle_recommendations": "Early sleep",
            "start_date": date.today().isoformat(),
            "items": [
                {
                    "therapy_id": therapy_id,
                    "session_count": 3,
                    "duration_minutes": 60,
                }
            ],
        },
        headers=doc_hdr,
    )
    assert plan_resp.status_code == 200
    plan_id = plan_resp.json()["id"]

    # 4. Finalize treatment plan
    finalize_resp = client.post(
        f"/api/v1/consultations/treatment-plans/{plan_id}/finalize",
        headers=doc_hdr,
    )
    assert finalize_resp.status_code == 200
    assert finalize_resp.json()["is_finalized"] is True

    # 5. Create Custom-priced package (Differentiator!)
    pkg_resp = client.post(
        "/api/v1/billing/packages",
        json={
            "treatment_plan_id": plan_id,
            "name": "Custom 3-Session Detox",
            "custom_price": 4200.00,  # Custom price negotiated
            "valid_from": date.today().isoformat(),
        },
        headers=admin_hdr,
    )
    assert pkg_resp.status_code == 201
    pkg_data = pkg_resp.json()
    assert pkg_data["custom_price"] == "4200.00"
    assert pkg_data["balance_due"] == 4200.0

    # 6. Run Scheduling Engine for 3 sessions
    alloc_resp = client.post(
        "/api/v1/scheduling/allocate",
        json={
            "treatment_plan_id": plan_id,
            "preferred_start_date": date.today().isoformat(),
        },
        headers=admin_hdr,
    )
    assert alloc_resp.status_code == 200
    alloc_data = alloc_resp.json()
    assert len(alloc_data["sessions"]) == 3
    session_1_id = alloc_data["sessions"][0]["id"]

    # 7. Check-in Session 1
    checkin_resp = client.post(
        f"/api/v1/scheduling/sessions/{session_1_id}/checkin",
        headers=admin_hdr,
    )
    assert checkin_resp.status_code == 200

    # 8. Complete Session 1 with observations
    th_hdr = get_token(th_uid, "therapist")
    complete_resp = client.post(
        f"/api/v1/scheduling/sessions/{session_1_id}/complete",
        json={
            "session_id": session_1_id,
            "observations": "Patient responded favorably, stiffness reduced",
            "patient_feedback": "Felt very relaxed",
            "oils_used": "Ksheerabala Taila",
            "pressure_level": "Medium",
        },
        headers=th_hdr,
    )
    assert complete_resp.status_code == 200

    # 9. Verify Patient Portal Summary
    # Patient logs in
    pat_user = TestingSessionLocal().query(User).filter(User.email == "rohan@test.com").first()
    pat_hdr = get_token(pat_user.id, "patient")

    portal_resp = client.get("/api/v1/patients/me/portal", headers=pat_hdr)
    assert portal_resp.status_code == 200
    p_data = portal_resp.json()

    # Safety compliance test: measures attendance, not recovery
    assert p_data["progress"]["attendance_label"] == "Session Attendance"
    assert p_data["progress"]["total_sessions"] == 3
    assert p_data["progress"]["completed_sessions"] == 1
    assert p_data["progress"]["attendance_percentage"] == 33.3

    # Check package balance due in portal
    assert p_data["packages"][0]["balance_due"] == 4200.0

    # 10. Patient requests reschedule on session 2
    session_2_id = alloc_data["sessions"][1]["id"]
    reschedule_resp = client.post(
        f"/api/v1/scheduling/sessions/{session_2_id}/reschedule-request",
        json={
            "preferred_date": (date.today() + timedelta(days=5)).isoformat(),
            "reason": "Office travel",
        },
        headers=pat_hdr,
    )
    assert reschedule_resp.status_code == 200

    # 11. Patient submits feedback on completed session
    feedback_resp = client.post(
        f"/api/v1/scheduling/sessions/{session_1_id}/feedback",
        json={
            "feedback": "Overall very good, stiffness much improved",
            "flag_doctor": False,
        },
        headers=pat_hdr,
    )
    assert feedback_resp.status_code == 200
