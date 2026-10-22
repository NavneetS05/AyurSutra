"""User and Account Management endpoints for Clinic Administrators."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.dependencies import AdminOnly, get_current_user, AnyRole
from app.core.security import hash_password
from app.db.session import get_db
from app.models import (
    User,
    UserRole,
    Staff,
    Patient,
    AuditLog,
)

router = APIRouter(prefix="/users", tags=["Users & Accounts"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class UserAccountOut(BaseModel):
    id: str
    email: str
    phone: Optional[str] = None
    role: UserRole
    is_active: bool
    is_online: bool = True
    working_hours_start: Optional[str] = "09:00"
    working_hours_end: Optional[str] = "18:00"
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class PresenceUpdate(BaseModel):
    is_online: Optional[bool] = None
    working_hours_start: Optional[str] = None
    working_hours_end: Optional[str] = None


class UserPresenceOut(BaseModel):
    user_id: str
    email: str
    role: str
    is_online: bool
    working_hours_start: str
    working_hours_end: str


class CreateUserAccount(BaseModel):
    email: EmailStr
    password: str
    role: UserRole
    phone: Optional[str] = None
    first_name: str
    last_name: str
    specialization: Optional[str] = None  # for doctor or therapist
    license_number: Optional[str] = None  # for doctor


class UpdateUserStatus(BaseModel):
    is_active: bool


class ResetUserPassword(BaseModel):
    new_password: str


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _to_user_account_out(u: User) -> UserAccountOut:
    fn, ln, spec, lic = None, None, None, None
    if u.staff_profile:
        fn = u.staff_profile.first_name
        ln = u.staff_profile.last_name
        spec = u.staff_profile.specialization
        lic = u.staff_profile.qualification
    elif u.patient_profile:
        fn = u.patient_profile.first_name
        ln = u.patient_profile.last_name
    else:
        fn = u.email.split("@")[0].capitalize()
        ln = ""

    return UserAccountOut(
        id=u.id,
        email=u.email,
        phone=u.phone,
        role=u.role,
        is_active=u.is_active,
        is_online=getattr(u, "is_online", True) if getattr(u, "is_online", True) is not None else True,
        working_hours_start=getattr(u, "working_hours_start", "09:00") or "09:00",
        working_hours_end=getattr(u, "working_hours_end", "18:00") or "18:00",
        first_name=fn,
        last_name=ln,
        specialization=spec,
        license_number=lic,
        created_at=u.created_at.isoformat() if u.created_at else "",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/me/presence", response_model=UserPresenceOut)
def get_my_presence(
    current_user: User = Depends(get_current_user),
):
    """Retrieve current user's online status and working hours."""
    return UserPresenceOut(
        user_id=current_user.id,
        email=current_user.email,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        is_online=getattr(current_user, "is_online", True) if getattr(current_user, "is_online", True) is not None else True,
        working_hours_start=getattr(current_user, "working_hours_start", "09:00") or "09:00",
        working_hours_end=getattr(current_user, "working_hours_end", "18:00") or "18:00",
    )


@router.patch("/me/presence", response_model=UserPresenceOut)
def update_my_presence(
    body: PresenceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle current user's online/offline status and configure working hours."""
    if body.is_online is not None:
        current_user.is_online = body.is_online
    if body.working_hours_start is not None:
        current_user.working_hours_start = body.working_hours_start
    if body.working_hours_end is not None:
        current_user.working_hours_end = body.working_hours_end

    status_str = "ONLINE" if current_user.is_online else "OFFLINE"
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_PRESENCE",
        entity_type="User",
        entity_id=current_user.id,
        detail=f"User marked themselves {status_str}. Working hours: {current_user.working_hours_start} - {current_user.working_hours_end}",
    )
    db.add(audit)
    db.commit()
    db.refresh(current_user)

    return UserPresenceOut(
        user_id=current_user.id,
        email=current_user.email,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        is_online=current_user.is_online,
        working_hours_start=current_user.working_hours_start or "09:00",
        working_hours_end=current_user.working_hours_end or "18:00",
    )


@router.get("", response_model=List[UserAccountOut])
def list_accounts(
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by email, name or phone"),
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    """List all registered system accounts. Admin only."""
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_filter)) |
            (User.phone.ilike(search_filter))
        )

    users = query.order_by(desc(User.created_at)).all()
    out = []
    for u in users:
        acc = _to_user_account_out(u)
        if search:
            # Also check first/last name
            term = search.lower()
            if term in (acc.first_name or "").lower() or term in (acc.last_name or "").lower() or term in acc.email.lower() or term in (acc.phone or ""):
                out.append(acc)
        else:
            out.append(acc)

    return out


@router.post("", response_model=UserAccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    body: CreateUserAccount,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Admin creates a new user account with role and corresponding staff or patient profile."""
    # Check email exists
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Account with this email already exists")

    if body.phone:
        existing_phone = db.query(User).filter(User.phone == body.phone).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Account with this phone already exists")

    # Create User
    new_user = User(
        email=body.email,
        phone=body.phone,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Create Staff or Patient profile
    if body.role in (UserRole.admin, UserRole.doctor, UserRole.receptionist, UserRole.therapist):
        staff = Staff(
            user_id=new_user.id,
            first_name=body.first_name,
            last_name=body.last_name,
            specialization=body.specialization,
            is_doctor=(body.role == UserRole.doctor),
            is_therapist=(body.role == UserRole.therapist),
        )
        db.add(staff)
    elif body.role == UserRole.patient:
        pat = Patient(
            user_id=new_user.id,
            first_name=body.first_name,
            last_name=body.last_name,
            phone=body.phone or "N/A",
            email=body.email,
        )
        db.add(pat)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_USER_ACCOUNT",
        entity_type="User",
        entity_id=new_user.id,
        detail=f"Admin created account for '{body.email}' with role '{body.role.value}' ({body.first_name} {body.last_name})",
    )
    db.add(audit)

    db.commit()
    db.refresh(new_user)
    return _to_user_account_out(new_user)


@router.patch("/{user_id}/status", response_model=UserAccountOut)
def toggle_account_status(
    user_id: str,
    body: UpdateUserStatus,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Deactivate or reactivate an account. Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if user.id == current_user.id and not body.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own admin account")

    user.is_active = body.is_active

    action_label = "ACTIVATED" if body.is_active else "DEACTIVATED"
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_USER_STATUS",
        entity_type="User",
        entity_id=user.id,
        detail=f"Admin {action_label} account for '{user.email}' (Role: {user.role.value})",
    )
    db.add(audit)
    db.commit()
    db.refresh(user)
    return _to_user_account_out(user)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: str,
    body: ResetUserPassword,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Directly reset an account's password. Admin only."""
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.hashed_password = hash_password(body.new_password)

    audit = AuditLog(
        user_id=current_user.id,
        action="RESET_USER_PASSWORD",
        entity_type="User",
        entity_id=user.id,
        detail=f"Admin reset password for account '{user.email}'",
    )
    db.add(audit)
    db.commit()

    return {"message": f"Password for {user.email} has been reset successfully"}


@router.delete("/{user_id}")
def delete_account(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Delete or safely deactivate an account. Admin only."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")

    user_email = user.email
    # Instead of breaking foreign key constraints on medical history, we deactivate and mark deleted
    user.is_active = False
    
    audit = AuditLog(
        user_id=current_user.id,
        action="DELETE_USER_ACCOUNT",
        entity_type="User",
        entity_id=user.id,
        detail=f"Admin deactivated and deleted account '{user_email}'",
    )
    db.add(audit)
    db.commit()

    return {"message": f"Account '{user_email}' deactivated and removed from active roster"}


class AdjustWorkingHours(BaseModel):
    working_hours_start: str
    working_hours_end: str


@router.patch("/{user_id}/working-hours", response_model=UserAccountOut)
def admin_adjust_working_hours(
    user_id: str,
    body: AdjustWorkingHours,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    """Admin endpoint to adjust the daily working shift hours of any staff account."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.working_hours_start = body.working_hours_start
    user.working_hours_end = body.working_hours_end

    staff_name = f"{user.staff_profile.first_name} {user.staff_profile.last_name}" if user.staff_profile else user.email
    audit = AuditLog(
        user_id=current_user.id,
        action="ADJUST_WORKING_HOURS",
        entity_type="User",
        entity_id=user.id,
        detail=f"Admin adjusted working hours for '{staff_name}' ({user.role.value}) to {body.working_hours_start} - {body.working_hours_end}",
    )
    db.add(audit)
    db.commit()
    db.refresh(user)

    return _to_user_account_out(user)
