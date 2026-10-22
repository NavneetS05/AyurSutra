from datetime import date, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOnly, StaffOnly
from app.core.security import hash_password
from app.db.session import get_db
from app.models import (
    Staff,
    StaffAvailability,
    TherapistTherapy,
    Therapy,
    User,
    UserRole,
)

router = APIRouter(prefix="/staff", tags=["Staff"])


class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    role: UserRole
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    is_therapist: bool = False
    is_doctor: bool = False


class AvailabilityCreate(BaseModel):
    weekday: Optional[int] = None  # 0=Mon, 6=Sun
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    leave_date: Optional[date] = None
    note: Optional[str] = None


class AvailabilityOut(BaseModel):
    id: str
    weekday: Optional[int]
    start_time: Optional[time]
    end_time: Optional[time]
    leave_date: Optional[date]
    note: Optional[str]

    class Config:
        from_attributes = True


class StaffOut(BaseModel):
    id: str
    user_id: str
    first_name: str
    last_name: str
    email: str
    role: str
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    is_therapist: bool
    is_doctor: bool
    is_online: bool = True
    working_hours_start: Optional[str] = "09:00"
    working_hours_end: Optional[str] = "18:00"
    authorized_therapy_ids: list[str] = []

    class Config:
        from_attributes = True


@router.get("", response_model=list[StaffOut])
@router.get("/", response_model=list[StaffOut])
def list_staff(
    is_therapist: Optional[bool] = None,
    is_doctor: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: User = StaffOnly,
):
    query = db.query(Staff).join(User, Staff.user_id == User.id)
    if is_therapist is not None:
        query = query.filter(Staff.is_therapist == is_therapist)
    if is_doctor is not None:
        query = query.filter(Staff.is_doctor == is_doctor)
    
    staff_list = query.all()
    results = []
    for s in staff_list:
        auth_ids = [tt.therapy_id for tt in s.authorized_therapies]
        is_on = getattr(s.user, "is_online", True) if getattr(s.user, "is_online", True) is not None else True
        wh_start = getattr(s.user, "working_hours_start", "09:00") or "09:00"
        wh_end = getattr(s.user, "working_hours_end", "18:00") or "18:00"
        results.append(
            StaffOut(
                id=s.id,
                user_id=s.user_id,
                first_name=s.first_name,
                last_name=s.last_name,
                email=s.user.email if s.user else "",
                role=s.user.role.value if s.user else "",
                specialization=s.specialization,
                qualification=s.qualification,
                is_therapist=s.is_therapist,
                is_doctor=s.is_doctor,
                is_online=is_on,
                working_hours_start=wh_start,
                working_hours_end=wh_end,
                authorized_therapy_ids=auth_ids,
            )
        )
    return results


@router.post("/", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    body: StaffCreate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.flush()

    staff = Staff(
        user_id=user.id,
        first_name=body.first_name,
        last_name=body.last_name,
        specialization=body.specialization,
        qualification=body.qualification,
        is_therapist=body.is_therapist or (body.role == UserRole.therapist),
        is_doctor=body.is_doctor or (body.role == UserRole.doctor),
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)

    return StaffOut(
        id=staff.id,
        user_id=staff.user_id,
        first_name=staff.first_name,
        last_name=staff.last_name,
        email=user.email,
        role=user.role.value,
        specialization=staff.specialization,
        qualification=staff.qualification,
        is_therapist=staff.is_therapist,
        is_doctor=staff.is_doctor,
        authorized_therapy_ids=[],
    )


@router.get("/{staff_id}/availability", response_model=list[AvailabilityOut])
def get_staff_availability(
    staff_id: str,
    db: Session = Depends(get_db),
    _: User = StaffOnly,
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff.availabilities


@router.post("/{staff_id}/availability", response_model=AvailabilityOut)
def add_staff_availability(
    staff_id: str,
    body: AvailabilityCreate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    avail = StaffAvailability(
        staff_id=staff.id,
        weekday=body.weekday,
        start_time=body.start_time,
        end_time=body.end_time,
        leave_date=body.leave_date,
        note=body.note,
    )
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


@router.post("/{staff_id}/therapies")
def set_authorized_therapies(
    staff_id: str,
    therapy_ids: list[str],
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Clear current and re-add
    db.query(TherapistTherapy).filter(TherapistTherapy.staff_id == staff_id).delete()
    for tid in therapy_ids:
        db.add(TherapistTherapy(staff_id=staff_id, therapy_id=tid))
    db.commit()
    return {"message": "Authorized therapies updated", "count": len(therapy_ids)}


class StaffWorkingHoursUpdate(BaseModel):
    working_hours_start: str
    working_hours_end: str


@router.patch("/{staff_id}/working-hours", response_model=StaffOut)
def adjust_staff_hours_endpoint(
    staff_id: str,
    body: StaffWorkingHoursUpdate,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Admin endpoint to adjust the working hours of a staff member."""
    from app.models import AuditLog

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    if staff.user:
        staff.user.working_hours_start = body.working_hours_start
        staff.user.working_hours_end = body.working_hours_end

    audit = AuditLog(
        user_id=current_user.id,
        action="ADJUST_STAFF_WORKING_HOURS",
        entity_type="Staff",
        entity_id=staff.id,
        detail=f"Admin adjusted working hours for '{staff.first_name} {staff.last_name}' to {body.working_hours_start} - {body.working_hours_end}",
    )
    db.add(audit)
    db.commit()
    db.refresh(staff)

    auth_ids = [tt.therapy_id for tt in staff.authorized_therapies]
    return StaffOut(
        id=staff.id,
        user_id=staff.user_id,
        first_name=staff.first_name,
        last_name=staff.last_name,
        email=staff.user.email if staff.user else "",
        role=staff.user.role.value if staff.user else "",
        specialization=staff.specialization,
        qualification=staff.qualification,
        is_therapist=staff.is_therapist,
        is_doctor=staff.is_doctor,
        is_online=staff.user.is_online if staff.user else True,
        working_hours_start=staff.user.working_hours_start if staff.user else "09:00",
        working_hours_end=staff.user.working_hours_end if staff.user else "18:00",
        authorized_therapy_ids=auth_ids,
    )
