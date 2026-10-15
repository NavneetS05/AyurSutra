from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOnly, StaffOnly, AnyRole
from app.db.session import get_db
from app.models import Room, User

router = APIRouter(prefix="/rooms", tags=["Rooms"])


class RoomCreate(BaseModel):
    name: str
    facilities: Optional[str] = None
    capacity: int = 1
    is_active: bool = True


class RoomUpdate(BaseModel):
    name: Optional[str] = None
    facilities: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None


class RoomOut(BaseModel):
    id: str
    name: str
    facilities: Optional[str] = None
    capacity: int
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=list[RoomOut])
def list_rooms(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    query = db.query(Room)
    if active_only:
        query = query.filter(Room.is_active == True)  # noqa: E712
    return query.order_by(Room.name).all()


@router.get("/{room_id}", response_model=RoomOut)
def get_room(
    room_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room


@router.post("/", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(
    body: RoomCreate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    existing = db.query(Room).filter(Room.name.ilike(body.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Room with this name already exists")
    
    room = Room(
        name=body.name,
        facilities=body.facilities,
        capacity=body.capacity,
        is_active=body.is_active,
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


@router.patch("/{room_id}", response_model=RoomOut)
def update_room(
    room_id: str,
    body: RoomUpdate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(room, field, val)

    db.commit()
    db.refresh(room)
    return room
