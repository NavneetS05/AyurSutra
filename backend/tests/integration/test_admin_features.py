import pytest
from datetime import date, datetime, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.session import Base, get_db
from app.main import app
from app.models import (
    Gender,
    Patient,
    Room,
    Staff,
    Therapy,
    TherapySession,
    TreatmentPlan,
    TreatmentPlanItem,
    User,
    UserRole,
    Consultation,
    ConsultationType,
    AuditLog,
)
from app.core.security import hash_password, create_access_token


from tests.conftest import TestSessionLocal, test_engine

TestingSessionLocal = TestSessionLocal
engine = test_engine


@pytest.fixture(autouse=True)
def setup_test_db():
    db = TestingSessionLocal()

    # Seed Admin User
    admin = User(
        email="admin@test.com",
        phone="9999999999",
        hashed_password=hash_password("AdminPass123"),
        role=UserRole.admin,
        is_active=True,
    )
    db.add(admin)
    db.flush()

    admin_staff = Staff(
        user_id=admin.id,
        first_name="Admin",
        last_name="Superuser",
    )
    db.add(admin_staff)

    # Seed Doctor
    doctor_user = User(
        email="vaidya@test.com",
        phone="8888888888",
        hashed_password=hash_password("DoctorPass123"),
        role=UserRole.doctor,
        is_active=True,
    )
    db.add(doctor_user)
    db.flush()

    doctor_staff = Staff(
        user_id=doctor_user.id,
        first_name="Rajesh",
        last_name="Sharma",
        specialization="Panchakarma Kayachikitsa",
        is_doctor=True,
    )
    db.add(doctor_staff)

    # Seed Therapist
    therapist_user = User(
        email="therapist@test.com",
        phone="7777777777",
        hashed_password=hash_password("TherapistPass123"),
        role=UserRole.therapist,
        is_active=True,
    )
    db.add(therapist_user)
    db.flush()

    therapist_staff = Staff(
        user_id=therapist_user.id,
        first_name="Deepa",
        last_name="Nair",
        specialization="Abhyanga & Shirodhara",
        is_therapist=True,
    )
    db.add(therapist_staff)

    # Seed Patient
    patient = Patient(
        first_name="Sunita",
        last_name="Verma",
        phone="9876543210",
        email="sunita@example.com",
        gender=Gender.female,
        allergies="Sesame",
        medical_history="Chronic migraine",
    )
    db.add(patient)
    db.flush()

    # Seed Room with assigned doc/therapist
    room = Room(
        name="Shanti Suite",
        facilities="table,steam,oil",
        capacity=1,
        status="active",
        assigned_doctor_id=doctor_staff.id,
        assigned_therapist_id=therapist_staff.id,
    )
    db.add(room)

    # Seed Consultation
    consultation = Consultation(
        patient_id=patient.id,
        doctor_id=doctor_staff.id,
        scheduled_at=datetime.utcnow() + timedelta(days=1),
        consultation_type=ConsultationType.initial,
        chief_complaint="Joint stiffness and stress",
        prakriti="Vata-Pitta",
        vikriti="Vata Vriddhi",
        consultation_fee=Decimal("600.00"),
        fee_paid=True,
    )
    db.add(consultation)

    db.commit()
    db.close()
    yield

    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_headers():
    db = TestingSessionLocal()
    admin = db.query(User).filter(User.email == "admin@test.com").first()
    token = create_access_token(subject=admin.id, role="admin")
    db.close()
    return {"Authorization": f"Bearer {token}"}


def test_users_management_crud(client, admin_headers):
    """Feature 2: Add or remove / deactivate accounts or reset passwords."""
    # 1. List accounts
    res = client.get("/api/v1/users", headers=admin_headers)
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) >= 3

    # 2. Create account
    create_payload = {
        "email": "reception@ayursutra.com",
        "password": "ReceptionPassword123",
        "role": "receptionist",
        "phone": "9123456789",
        "first_name": "Meera",
        "last_name": "Patel",
    }
    create_res = client.post("/api/v1/users", json=create_payload, headers=admin_headers)
    assert create_res.status_code == 201
    created_acc = create_res.json()
    user_id = created_acc["id"]
    assert created_acc["email"] == "reception@ayursutra.com"
    assert created_acc["first_name"] == "Meera"

    # 3. Deactivate account
    deactivate_res = client.patch(f"/api/v1/users/{user_id}/status", json={"is_active": False}, headers=admin_headers)
    assert deactivate_res.status_code == 200
    assert deactivate_res.json()["is_active"] is False

    # 4. Reactivate account
    activate_res = client.patch(f"/api/v1/users/{user_id}/status", json={"is_active": True}, headers=admin_headers)
    assert activate_res.status_code == 200
    assert activate_res.json()["is_active"] is True

    # 5. Reset password
    pw_res = client.post(f"/api/v1/users/{user_id}/reset-password", json={"new_password": "NewSecretPassword123"}, headers=admin_headers)
    assert pw_res.status_code == 200
    assert "reset successfully" in pw_res.json()["message"]

    # 6. Delete account
    del_res = client.delete(f"/api/v1/users/{user_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_room_management_features(client, admin_headers):
    """Feature 4: Add or remove rooms / update status and assign them to doc and therapist."""
    # 1. List rooms
    res = client.get("/api/v1/rooms/", headers=admin_headers)
    assert res.status_code == 200
    rooms = res.json()
    assert len(rooms) >= 1
    assert rooms[0]["status"] == "active"
    assert rooms[0]["assigned_doctor_name"] is not None

    # 2. Create room with assigned staff and status
    new_room = {
        "name": "Dhanvantari Sanctum",
        "facilities": "wooden_droni,copper_pot,steam_box",
        "capacity": 1,
        "status": "cleaning",
        "assigned_doctor_id": rooms[0]["assigned_doctor_id"],
        "assigned_therapist_id": rooms[0]["assigned_therapist_id"],
    }
    create_res = client.post("/api/v1/rooms/", json=new_room, headers=admin_headers)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["status"] == "cleaning"
    assert created["assigned_doctor_name"] is not None
    room_id = created["id"]

    # 3. Update room status to maintenance
    update_res = client.patch(f"/api/v1/rooms/{room_id}", json={"status": "maintenance"}, headers=admin_headers)
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "maintenance"

    # 4. Delete room
    del_res = client.delete(f"/api/v1/rooms/{room_id}", headers=admin_headers)
    assert del_res.status_code == 200


def test_unique_patient_360_history(client, admin_headers):
    """Feature 3: Section to show unique patient name and full history across all visits."""
    # List unique patients
    list_res = client.get("/api/v1/patients/", headers=admin_headers)
    assert list_res.status_code == 200
    patients = list_res.json()
    assert len(patients) >= 1
    pat_id = patients[0]["id"]
    assert patients[0]["consultation_count"] >= 1

    # Get full longitudinal history
    history_res = client.get(f"/api/v1/patients/{pat_id}/full-history", headers=admin_headers)
    assert history_res.status_code == 200
    data = history_res.json()
    assert "patient" in data
    assert "summary" in data
    assert "consultations" in data
    assert "treatment_plans" in data
    assert "therapy_sessions" in data
    assert "packages" in data
    assert "payments" in data
    assert data["summary"]["total_visits"] >= 1
    assert data["summary"]["compliance_metric_name"] == "Session Attendance Rate"


def test_audit_logs_user_summary(client, admin_headers):
    """Feature 1: Show activity of each account in special logs section."""
    res = client.get("/api/v1/audit-logs/user-summary", headers=admin_headers)
    assert res.status_code == 200
    summaries = res.json()
    assert len(summaries) >= 1
    admin_summary = next((s for s in summaries if s["user_email"] == "admin@test.com"), None)
    assert admin_summary is not None
    assert "total_actions" in admin_summary
    assert "patients_created" in admin_summary
    assert "consultations_booked" in admin_summary


def test_daywise_and_upcoming_patients(client, admin_headers):
    """Feature 5: Show patients daywise and upcoming patients."""
    res = client.get("/api/v1/scheduling/daywise?days=7", headers=admin_headers)
    assert res.status_code == 200
    days = res.json()
    assert len(days) == 7
    # One of the days should have the consultation we seeded
    has_scheduled = any(len(d["consultations"]) > 0 for d in days)
    assert has_scheduled is True
