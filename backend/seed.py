"""
Seed script — populates the DB with synthetic demo data.
Run: python seed.py

Creates:
  - 1 admin, 1 receptionist, 1 doctor, 2 therapists, 3 patients (with portal accounts)
  - Therapies (Abhyanga, Shirodhara, Panchakarma, Nasya)
  - Rooms
  - Staff availability (Mon–Sat 08:00–18:00)
  - Therapist–therapy authorizations
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, time, datetime, timedelta

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models import (
    Gender,
    Patient,
    Room,
    Staff,
    StaffAvailability,
    Therapy,
    TherapistTherapy,
    User,
    UserRole,
)


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Seeding users and staff...")

        # Admin
        admin_user = User(email="admin@ayursutra.com", hashed_password=hash_password("Admin@123"), role=UserRole.admin)
        db.add(admin_user)

        # Receptionist
        rec_user = User(email="reception@ayursutra.com", hashed_password=hash_password("Recept@123"), role=UserRole.receptionist)
        db.add(rec_user)

        # Doctor
        doc_user = User(email="dr.sharma@ayursutra.com", hashed_password=hash_password("Doctor@123"), role=UserRole.doctor)
        db.add(doc_user)

        # Therapists
        th1_user = User(email="therapist1@ayursutra.com", hashed_password=hash_password("Therapy@123"), role=UserRole.therapist)
        th2_user = User(email="therapist2@ayursutra.com", hashed_password=hash_password("Therapy@123"), role=UserRole.therapist)
        db.add_all([th1_user, th2_user])
        db.flush()

        # Staff profiles
        admin_staff = Staff(user_id=admin_user.id, first_name="Admin", last_name="Ayursutra", is_therapist=False, is_doctor=False)
        rec_staff = Staff(user_id=rec_user.id, first_name="Priya", last_name="Nair", is_therapist=False, is_doctor=False)
        doc_staff = Staff(user_id=doc_user.id, first_name="Dr. Rajesh", last_name="Sharma", specialization="Panchakarma", qualification="BAMS, MD", is_therapist=False, is_doctor=True)
        th1_staff = Staff(user_id=th1_user.id, first_name="Anitha", last_name="Krishnan", is_therapist=True, is_doctor=False)
        th2_staff = Staff(user_id=th2_user.id, first_name="Ravi", last_name="Menon", is_therapist=True, is_doctor=False)
        db.add_all([admin_staff, rec_staff, doc_staff, th1_staff, th2_staff])
        db.flush()

        # Staff availability: Mon–Sat (0–5), 08:00–18:00
        for staff_obj in [th1_staff, th2_staff, doc_staff]:
            for weekday in range(6):  # Mon=0 to Sat=5
                db.add(StaffAvailability(
                    staff_id=staff_obj.id,
                    weekday=weekday,
                    start_time=time(8, 0),
                    end_time=time(18, 0),
                ))

        print("Seeding therapies...")
        therapies_data = [
            {"name": "Abhyanga", "desc": "Full body oil massage", "duration": 60, "price": 1200, "facilities": "table,oil"},
            {"name": "Shirodhara", "desc": "Continuous oil flow on forehead", "duration": 45, "price": 1500, "facilities": "shirodhara_stand,table"},
            {"name": "Nasya", "desc": "Nasal administration of medicated oils", "duration": 30, "price": 800, "facilities": "table"},
            {"name": "Basti", "desc": "Medicated enema therapy", "duration": 90, "price": 2000, "facilities": "table,basti_equipment"},
            {"name": "Udvartana", "desc": "Herbal powder massage", "duration": 60, "price": 1000, "facilities": "table,powder"},
        ]
        therapy_objs = []
        for t in therapies_data:
            therapy = Therapy(name=t["name"], description=t["desc"], default_duration_minutes=t["duration"], suggested_price=t["price"], required_facilities=t["facilities"])
            db.add(therapy)
            therapy_objs.append(therapy)
        db.flush()

        # Authorize therapists for therapies
        for therapy in therapy_objs:
            db.add(TherapistTherapy(staff_id=th1_staff.id, therapy_id=therapy.id))
        for therapy in therapy_objs[:3]:  # th2 authorized for first 3 only
            db.add(TherapistTherapy(staff_id=th2_staff.id, therapy_id=therapy.id))

        print("Seeding rooms...")
        rooms_data = [
            {"name": "Room 1 — Abhyanga", "facilities": "table,oil,towel,steam"},
            {"name": "Room 2 — Shirodhara", "facilities": "shirodhara_stand,table,oil,towel"},
            {"name": "Room 3 — General", "facilities": "table,powder,basti_equipment"},
        ]
        for r in rooms_data:
            db.add(Room(name=r["name"], facilities=r["facilities"]))

        print("Seeding patients...")
        patients_data = [
            {"first": "Rahul", "last": "Verma", "phone": "9876543210", "email": "rahul@demo.com", "dob": date(1990, 5, 15), "gender": Gender.male},
            {"first": "Sunita", "last": "Patel", "phone": "9876543211", "email": "sunita@demo.com", "dob": date(1985, 8, 22), "gender": Gender.female},
            {"first": "Arun", "last": "Kumar", "phone": "9876543212", "email": "arun@demo.com", "dob": date(1978, 3, 10), "gender": Gender.male},
        ]
        for pd in patients_data:
            portal_user = User(email=pd["email"], hashed_password=hash_password("Patient@123"), role=UserRole.patient)
            db.add(portal_user)
            db.flush()
            patient = Patient(
                user_id=portal_user.id,
                first_name=pd["first"],
                last_name=pd["last"],
                phone=pd["phone"],
                email=pd["email"],
                date_of_birth=pd["dob"],
                gender=pd["gender"],
            )
            db.add(patient)
        # Keep first patient for consultation
        first_patient = db.query(Patient).filter(Patient.phone == "9876543210").first()
        abhyanga_th = db.query(Therapy).filter(Therapy.name == "Abhyanga").first()
        if first_patient and doc_staff and abhyanga_th:
            from decimal import Decimal
            from app.models import (
                Consultation,
                ConsultationType,
                TreatmentPlan,
                TreatmentPlanItem,
                PatientPackage,
                Payment,
                PaymentMethod,
                PaymentStatus,
                PackageStatus,
                Receipt,
            )
            from app.services.scheduler import SchedulingEngine

            consult = Consultation(
                patient_id=first_patient.id,
                doctor_id=doc_staff.id,
                consultation_type=ConsultationType.initial,
                scheduled_at=datetime.utcnow() - timedelta(days=2),
                chief_complaint="Severe lower back stiffness, chronic fatigue, and joint pain",
                prakriti="Vata-Pitta",
                vikriti="Aggravated Vata with Ama accumulation",
                consultation_fee=500.00,
                fee_paid=True,
            )
            db.add(consult)
            db.flush()

            # Create treatment plan
            plan = TreatmentPlan(
                consultation_id=consult.id,
                title="Vata Shamana & Rejuvenation Protocol",
                objectives="Restore doshic equilibrium, relieve muscular stiffness, enhance vitality",
                diet_recommendations="Lightly cooked warm meals with rock salt and cow ghee; avoid cold salads, curd at night, and carbonated beverages",
                lifestyle_recommendations="Daily morning gentle pranayama, warm oil self-massage, strictly avoid late night screen exposure",
                start_date=date.today(),
                end_date=date.today() + timedelta(days=7),
                is_finalized=True,
            )
            db.add(plan)
            db.flush()

            plan_item = TreatmentPlanItem(
                plan_id=plan.id,
                therapy_id=abhyanga_th.id,
                session_count=3,
                duration_minutes=60,
                frequency_per_week=3,
            )
            db.add(plan_item)
            db.flush()

            # Custom-priced package (Differentiator demo)
            pkg = PatientPackage(
                patient_id=first_patient.id,
                treatment_plan_id=plan.id,
                name="AyurSutra 3-Session Detox & Vata Care",
                custom_price=Decimal("4500.00"),
                amount_paid=Decimal("2000.00"),
                payment_status=PaymentStatus.partial,
                status=PackageStatus.active,
                valid_from=date.today(),
                valid_until=date.today() + timedelta(days=30),
            )
            db.add(pkg)
            db.flush()

            # Partial payment & receipt
            payment = Payment(
                patient_id=first_patient.id,
                package_id=pkg.id,
                amount=Decimal("2000.00"),
                method=PaymentMethod.upi,
                reference_number="UPI/2026/987654",
                paid_at=datetime.utcnow() - timedelta(days=1),
            )
            db.add(payment)
            db.flush()

            receipt = Receipt(
                payment_id=payment.id,
                receipt_number="REC-20261015-DEMO01",
            )
            db.add(receipt)

            # Run scheduler allocation
            sched_engine = SchedulingEngine(
                db=db,
                clinic_open=settings.clinic_open,
                clinic_close=settings.clinic_close,
            )
            alloc_results = sched_engine.allocate(
                plan_items=[plan_item],
                patient_id=first_patient.id,
                preferred_start_date=date.today(),
            )
            allocated = []
            for res in alloc_results:
                for s in res.assigned:
                    db.add(s)
                    allocated.append(s)
            db.flush()

            # Mark session 1 as completed with observations
            if allocated:
                from app.models import SessionRecord, SessionStatus
                s1 = allocated[0]
                s1.status = SessionStatus.completed
                s1.actual_start = s1.scheduled_start
                s1.actual_end = s1.scheduled_end
                record = SessionRecord(
                    session_id=s1.id,
                    observations="Patient displayed significant reduction in lumbar stiffness. Pulse stabilized.",
                    patient_feedback="Felt very relaxed and warm. Muscle pain reduced considerably.",
                    oils_used="Mahanarayana Taila & Ksheerabala 101",
                    pressure_level="Madhyama (Medium)",
                    therapist_notes="Follow up with warm water intake post therapy",
                    flagged_for_doctor=False,
                )
                db.add(record)

        db.commit()
        print("\nSeed complete!")
        print("\nDemo credentials:")
        print("  Admin:        admin@ayursutra.com       / Admin@123")
        print("  Receptionist: reception@ayursutra.com   / Recept@123")
        print("  Doctor:       dr.sharma@ayursutra.com   / Doctor@123")
        print("  Therapist 1:  therapist1@ayursutra.com  / Therapy@123")
        print("  Patient:      rahul@demo.com            / Patient@123")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
