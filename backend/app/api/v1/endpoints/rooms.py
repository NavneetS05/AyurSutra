from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOnly, StaffOnly, AnyRole
from app.db.session import get_db
from app.models import Room, User, AuditLog, Staff

router = APIRouter(prefix="/rooms", tags=["Rooms"])


class RoomCreate(BaseModel):
    name: str
    facilities: Optional[str] = None
    capacity: int = 1
    is_active: bool = True
    status: Optional[str] = "active"
    assigned_doctor_id: Optional[str] = None
    assigned_therapist_id: Optional[str] = None


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    facilities: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    assigned_doctor_id: Optional[str] = None
    assigned_therapist_id: Optional[str] = None


class RoomOut(BaseModel):
    id: str
    name: str
    facilities: Optional[str] = None
    capacity: int
    is_active: bool
    status: str = "active"
    assigned_doctor_id: Optional[str] = None
    assigned_therapist_id: Optional[str] = None
    assigned_doctor_name: Optional[str] = None
    assigned_therapist_name: Optional[str] = None

    class Config:
        from_attributes = True


def _to_room_out(room: Room) -> RoomOut:
    doc_name = None
    if room.assigned_doctor:
        doc_name = f"Dr. {room.assigned_doctor.first_name} {room.assigned_doctor.last_name}"
    therapist_name = None
    if room.assigned_therapist:
        therapist_name = f"{room.assigned_therapist.first_name} {room.assigned_therapist.last_name}"

    return RoomOut(
        id=room.id,
        name=room.name,
        facilities=room.facilities,
        capacity=room.capacity,
        is_active=room.is_active,
        status=room.status or "active",
        assigned_doctor_id=room.assigned_doctor_id,
        assigned_therapist_id=room.assigned_therapist_id,
        assigned_doctor_name=doc_name,
        assigned_therapist_name=therapist_name,
    )


@router.get("/", response_model=List[RoomOut])
def list_rooms(
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    query = db.query(Room)
    if active_only:
        query = query.filter(Room.is_active == True)  # noqa: E712
    rooms = query.order_by(Room.name).all()
    return [_to_room_out(r) for r in rooms]


@router.get("/{room_id}", response_model=RoomOut)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _to_room_out(room)


@router.post("/", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    existing = db.query(Room).filter(Room.name.ilike(body.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Room with this name already exists")

    if body.assigned_doctor_id:
        doc = db.query(Staff).filter(Staff.id == body.assigned_doctor_id).first()
        if not doc:
            raise HTTPException(status_code=400, detail="Assigned doctor not found")

    if body.assigned_therapist_id:
        th = db.query(Staff).filter(Staff.id == body.assigned_therapist_id).first()
        if not th:
            raise HTTPException(status_code=400, detail="Assigned therapist not found")

    room = Room(
        name=body.name,
        facilities=body.facilities,
        capacity=body.capacity,
        is_active=body.is_active,
        status=body.status or "active",
        assigned_doctor_id=body.assigned_doctor_id,
        assigned_therapist_id=body.assigned_therapist_id,
    )
    db.add(room)
    db.flush()

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE_ROOM",
        entity_type="Room",
        entity_id=room.id,
        detail=f"Created room '{room.name}' (status: {room.status})",
    )
    db.add(audit)
    db.commit()
    db.refresh(room)
    return _to_room_out(room)


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: str,
    body: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    update_dict = body.model_dump(exclude_unset=True)
    if "assigned_doctor_id" in update_dict and update_dict["assigned_doctor_id"]:
        doc = db.query(Staff).filter(Staff.id == update_dict["assigned_doctor_id"]).first()
        if not doc:
            raise HTTPException(status_code=400, detail="Assigned doctor not found")
    if "assigned_therapist_id" in update_dict and update_dict["assigned_therapist_id"]:
        th = db.query(Staff).filter(Staff.id == update_dict["assigned_therapist_id"]).first()
        if not th:
            raise HTTPException(status_code=400, detail="Assigned therapist not found")

    for field, val in update_dict.items():
        setattr(room, field, val)

    # Log audit
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE_ROOM",
        entity_type="Room",
        entity_id=room.id,
        detail=f"Updated room '{room.name}' (status: {room.status}, doctor: {room.assigned_doctor_id}, therapist: {room.assigned_therapist_id})",
    )
    db.add(audit)

    db.commit()
    db.refresh(room)
    return _to_room_out(room)


@router.delete("/{room_id}", status_code=status.HTTP_200_OK)
def delete_room(
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = AdminOnly,
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # If sessions reference this room, we deactivate it safely rather than hard deleting to preserve historical records
    has_sessions = len(room.therapy_sessions) > 0
    room_name = room.name
    if has_sessions:
        room.is_active = False
        room.status = "maintenance"
        detail_msg = f"Deactivated room '{room_name}' (retained due to {len(room.therapy_sessions)} historical therapy sessions)"
    else:
        db.delete(room)
        detail_msg = f"Deleted room '{room_name}' permanently"

    audit = AuditLog(
        user_id=current_user.id,
        action="DELETE_ROOM",
        entity_type="Room",
        entity_id=room_id,
        detail=detail_msg,
    )
    db.add(audit)
    db.commit()

    return {"message": detail_msg, "deleted": not has_sessions, "deactivated": has_sessions}
