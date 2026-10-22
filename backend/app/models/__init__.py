import enum
import uuid
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import TSRANGE
from sqlalchemy.orm import relationship

from app.db.session import Base


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class UserRole(str, enum.Enum):
    admin = "admin"
    receptionist = "receptionist"
    doctor = "doctor"
    therapist = "therapist"
    patient = "patient"


class Gender(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"


class SessionStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    checked_in = "checked_in"
    in_progress = "in_progress"
    completed = "completed"
    missed = "missed"
    cancelled = "cancelled"
    rescheduled = "rescheduled"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    partial = "partial"
    paid = "paid"
    refunded = "refunded"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    upi = "upi"
    card = "card"
    bank_transfer = "bank_transfer"


class PackageStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ConsultationType(str, enum.Enum):
    initial = "initial"
    follow_up = "follow_up"
    assessment = "assessment"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def uuid_str() -> str:
    return str(uuid.uuid4())


IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Returns current datetime in Indian Standard Time (IST, UTC+05:30)."""
    return datetime.now(IST).replace(tzinfo=None)


# Alias so all model defaults (created_at, updated_at, paid_at, generated_at) use IST
now_utc = now_ist


# ---------------------------------------------------------------------------
# SYSTEM DOMAIN
# ---------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=uuid_str)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(20), unique=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_online = Column(Boolean, default=True, nullable=False)
    working_hours_start = Column(String(10), default="09:00", nullable=True)
    working_hours_end = Column(String(10), default="18:00", nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    # Relationships
    staff_profile = relationship("Staff", back_populates="user", uselist=False)
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    audit_logs = relationship("AuditLog", back_populates="user")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g. "UPDATE_TREATMENT_PLAN"
    entity_type = Column(String(100), nullable=False)  # e.g. "TreatmentPlan"
    entity_id = Column(String(36), nullable=False)
    detail = Column(Text, nullable=True)  # JSON diff or description
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)


# ---------------------------------------------------------------------------
# OPERATIONAL DOMAIN — Staff, Rooms, Therapies
# ---------------------------------------------------------------------------


class Staff(Base):
    __tablename__ = "staff"

    id = Column(String(36), primary_key=True, default=uuid_str)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialization = Column(String(200), nullable=True)
    qualification = Column(String(200), nullable=True)
    is_therapist = Column(Boolean, default=False, nullable=False)
    is_doctor = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User", back_populates="staff_profile")
    availabilities = relationship("StaffAvailability", back_populates="staff")
    authorized_therapies = relationship("TherapistTherapy", back_populates="staff")
    therapy_sessions = relationship("TherapySession", back_populates="therapist")
    consultations = relationship("Consultation", back_populates="doctor")


class StaffAvailability(Base):
    """Working hours per weekday (0=Mon…6=Sun) and leave dates."""

    __tablename__ = "staff_availability"

    id = Column(String(36), primary_key=True, default=uuid_str)
    staff_id = Column(String(36), ForeignKey("staff.id"), nullable=False)
    weekday = Column(Integer, nullable=True)  # 0-6; NULL means leave
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    leave_date = Column(Date, nullable=True)  # specific day off
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    staff = relationship("Staff", back_populates="availabilities")


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String(36), primary_key=True, default=uuid_str)
    name = Column(String(100), unique=True, nullable=False)
    facilities = Column(Text, nullable=True)  # comma-separated tags
    capacity = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(String(50), default="active", nullable=False)  # active, maintenance, cleaning
    assigned_doctor_id = Column(String(36), ForeignKey("staff.id"), nullable=True)
    assigned_therapist_id = Column(String(36), ForeignKey("staff.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    therapy_sessions = relationship("TherapySession", back_populates="room")
    assigned_doctor = relationship("Staff", foreign_keys=[assigned_doctor_id])
    assigned_therapist = relationship("Staff", foreign_keys=[assigned_therapist_id])


class Therapy(Base):
    __tablename__ = "therapies"

    id = Column(String(36), primary_key=True, default=uuid_str)
    name = Column(String(200), unique=True, nullable=False)
    category = Column(String(50), default="upakarma", nullable=True)  # pradhana_karma, poorva_karma, paschat_karma, upakarma
    dosha_target = Column(String(100), nullable=True)  # e.g. Vata, Pitta, Kapha
    indications = Column(Text, nullable=True)  # classical conditions & indications
    description = Column(Text, nullable=True)
    default_duration_minutes = Column(Integer, nullable=False, default=60)
    suggested_price = Column(Numeric(10, 2), nullable=True)
    required_facilities = Column(Text, nullable=True)  # comma-separated
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    plan_items = relationship("TreatmentPlanItem", back_populates="therapy")
    authorized_therapists = relationship("TherapistTherapy", back_populates="therapy")


class TherapistTherapy(Base):
    """Many-to-many: which therapist is authorized for which therapy."""

    __tablename__ = "therapist_therapies"

    id = Column(String(36), primary_key=True, default=uuid_str)
    staff_id = Column(String(36), ForeignKey("staff.id"), nullable=False)
    therapy_id = Column(String(36), ForeignKey("therapies.id"), nullable=False)

    __table_args__ = (UniqueConstraint("staff_id", "therapy_id"),)

    staff = relationship("Staff", back_populates="authorized_therapies")
    therapy = relationship("Therapy", back_populates="authorized_therapists")


# ---------------------------------------------------------------------------
# CLINICAL DOMAIN — Patients, Consultations, Treatment Plans
# ---------------------------------------------------------------------------


class Patient(Base):
    __tablename__ = "patients"

    id = Column(String(36), primary_key=True, default=uuid_str)
    patient_number = Column(String(50), unique=True, nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(Enum(Gender), nullable=True)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    allergies = Column(Text, nullable=True)
    medical_history = Column(Text, nullable=True)
    registration_date = Column(Date, default=date.today, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    user = relationship("User", back_populates="patient_profile")
    consultations = relationship("Consultation", back_populates="patient")
    packages = relationship("PatientPackage", back_populates="patient")
    payments = relationship("Payment", back_populates="patient")

    @property
    def uhid(self) -> str:
        return self.patient_number or (f"AYUR-{self.id[:8].upper()}" if self.id else "AYUR-PATIENT")



class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(String(36), primary_key=True, default=uuid_str)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(String(36), ForeignKey("staff.id"), nullable=False)
    consultation_type = Column(Enum(ConsultationType), default=ConsultationType.initial)
    scheduled_at = Column(DateTime, nullable=False)
    notes = Column(Text, nullable=True)
    chief_complaint = Column(Text, nullable=True)
    prakriti = Column(String(100), nullable=True)  # Vata/Pitta/Kapha
    vikriti = Column(String(200), nullable=True)
    consultation_fee = Column(Numeric(10, 2), nullable=False, default=0)
    fee_paid = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    patient = relationship("Patient", back_populates="consultations")
    doctor = relationship("Staff", back_populates="consultations")
    treatment_plan = relationship("TreatmentPlan", back_populates="consultation", uselist=False)
    payments = relationship("Payment", back_populates="consultation")


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id = Column(String(36), primary_key=True, default=uuid_str)
    consultation_id = Column(String(36), ForeignKey("consultations.id"), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    objectives = Column(Text, nullable=True)
    diet_recommendations = Column(Text, nullable=True)
    lifestyle_recommendations = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_finalized = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    consultation = relationship("Consultation", back_populates="treatment_plan")
    items = relationship("TreatmentPlanItem", back_populates="plan", cascade="all, delete-orphan")
    package = relationship("PatientPackage", back_populates="treatment_plan", uselist=False)


class TreatmentPlanItem(Base):
    """Each row = one therapy × session count × duration in the plan."""

    __tablename__ = "treatment_plan_items"

    id = Column(String(36), primary_key=True, default=uuid_str)
    plan_id = Column(String(36), ForeignKey("treatment_plans.id"), nullable=False)
    therapy_id = Column(String(36), ForeignKey("therapies.id"), nullable=False)
    session_count = Column(Integer, nullable=False, default=1)
    duration_minutes = Column(Integer, nullable=False)  # override per patient
    frequency_per_week = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    plan = relationship("TreatmentPlan", back_populates="items")
    therapy = relationship("Therapy", back_populates="plan_items")
    sessions = relationship("TherapySession", back_populates="plan_item")


# ---------------------------------------------------------------------------
# COMMERCIAL DOMAIN — Packages, Payments, Receipts
# ---------------------------------------------------------------------------


class PatientPackage(Base):
    __tablename__ = "patient_packages"

    id = Column(String(36), primary_key=True, default=uuid_str)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    treatment_plan_id = Column(String(36), ForeignKey("treatment_plans.id"), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    custom_price = Column(Numeric(10, 2), nullable=False)  # doctor/admin set
    amount_paid = Column(Numeric(10, 2), default=0, nullable=False)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False)
    status = Column(Enum(PackageStatus), default=PackageStatus.active, nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    patient = relationship("Patient", back_populates="packages")
    treatment_plan = relationship("TreatmentPlan", back_populates="package")
    payments = relationship("Payment", back_populates="package")

    @property
    def balance_due(self):
        return float(self.custom_price) - float(self.amount_paid)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=uuid_str)
    patient_id = Column(String(36), ForeignKey("patients.id"), nullable=False)
    package_id = Column(String(36), ForeignKey("patient_packages.id"), nullable=True)
    consultation_id = Column(String(36), ForeignKey("consultations.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    method = Column(Enum(PaymentMethod), nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    paid_at = Column(DateTime, default=now_utc, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    patient = relationship("Patient", back_populates="payments")
    package = relationship("PatientPackage", back_populates="payments")
    consultation = relationship("Consultation", back_populates="payments")
    receipt = relationship("Receipt", back_populates="payment", uselist=False)


class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String(36), primary_key=True, default=uuid_str)
    payment_id = Column(String(36), ForeignKey("payments.id"), unique=True, nullable=False)
    receipt_number = Column(String(50), unique=True, nullable=False)
    pdf_path = Column(String(500), nullable=True)
    generated_at = Column(DateTime, default=now_utc, nullable=False)

    payment = relationship("Payment", back_populates="receipt")


# ---------------------------------------------------------------------------
# OPERATIONAL DOMAIN — Therapy Sessions & Records
# ---------------------------------------------------------------------------


class TherapySession(Base):
    __tablename__ = "therapy_sessions"

    id = Column(String(36), primary_key=True, default=uuid_str)
    plan_item_id = Column(String(36), ForeignKey("treatment_plan_items.id"), nullable=False)
    therapist_id = Column(String(36), ForeignKey("staff.id"), nullable=False)
    room_id = Column(String(36), ForeignKey("rooms.id"), nullable=False)
    session_number = Column(Integer, nullable=False)  # 1-of-N within plan item
    scheduled_start = Column(DateTime, nullable=False)
    scheduled_end = Column(DateTime, nullable=False)
    actual_start = Column(DateTime, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    status = Column(Enum(SessionStatus), default=SessionStatus.scheduled, nullable=False)
    rescheduled_from_id = Column(String(36), ForeignKey("therapy_sessions.id"), nullable=True)
    created_at = Column(DateTime, default=now_utc, nullable=False)
    updated_at = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    plan_item = relationship("TreatmentPlanItem", back_populates="sessions")
    therapist = relationship("Staff", back_populates="therapy_sessions")
    room = relationship("Room", back_populates="therapy_sessions")
    record = relationship("SessionRecord", back_populates="session", uselist=False)
    rescheduled_from = relationship("TherapySession", remote_side="TherapySession.id")


class SessionRecord(Base):
    """Clinical notes recorded after a session is completed."""

    __tablename__ = "session_records"

    id = Column(String(36), primary_key=True, default=uuid_str)
    session_id = Column(String(36), ForeignKey("therapy_sessions.id"), unique=True, nullable=False)
    observations = Column(Text, nullable=True)
    patient_feedback = Column(Text, nullable=True)
    oils_used = Column(String(300), nullable=True)
    pressure_level = Column(String(50), nullable=True)
    therapist_notes = Column(Text, nullable=True)
    flagged_for_doctor = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=now_utc, nullable=False)

    session = relationship("TherapySession", back_populates="record")
