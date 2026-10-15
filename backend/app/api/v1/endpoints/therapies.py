from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import AdminOnly, StaffOnly, AnyRole
from app.db.session import get_db
from app.models import Therapy, User

router = APIRouter(prefix="/therapies", tags=["Therapies"])


class TherapyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    default_duration_minutes: int = 60
    suggested_price: Optional[Decimal] = None
    required_facilities: Optional[str] = None
    is_active: bool = True


class TherapyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_duration_minutes: Optional[int] = None
    suggested_price: Optional[Decimal] = None
    required_facilities: Optional[str] = None
    is_active: Optional[bool] = None


class TherapyOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    default_duration_minutes: int
    suggested_price: Optional[Decimal] = None
    required_facilities: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


@router.get("/", response_model=list[TherapyOut])
def list_therapies(
    active_only: bool = True,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    query = db.query(Therapy)
    if active_only:
        query = query.filter(Therapy.is_active == True)  # noqa: E712
    return query.order_by(Therapy.name).all()


@router.get("/{therapy_id}", response_model=TherapyOut)
def get_therapy(
    therapy_id: str,
    db: Session = Depends(get_db),
    _: User = AnyRole,
):
    therapy = db.query(Therapy).filter(Therapy.id == therapy_id).first()
    if not therapy:
        raise HTTPException(status_code=404, detail="Therapy not found")
    return therapy


@router.post("/", response_model=TherapyOut, status_code=status.HTTP_201_CREATED)
def create_therapy(
    body: TherapyCreate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    existing = db.query(Therapy).filter(Therapy.name.ilike(body.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Therapy with this name already exists")
    
    therapy = Therapy(
        name=body.name,
        description=body.description,
        default_duration_minutes=body.default_duration_minutes,
        suggested_price=body.suggested_price,
        required_facilities=body.required_facilities,
        is_active=body.is_active,
    )
    db.add(therapy)
    db.commit()
    db.refresh(therapy)
    return therapy


@router.patch("/{therapy_id}", response_model=TherapyOut)
def update_therapy(
    therapy_id: str,
    body: TherapyUpdate,
    db: Session = Depends(get_db),
    _: User = AdminOnly,
):
    therapy = db.query(Therapy).filter(Therapy.id == therapy_id).first()
    if not therapy:
        raise HTTPException(status_code=404, detail="Therapy not found")

    for field, val in body.model_dump(exclude_none=True).items():
        setattr(therapy, field, val)

    db.commit()
    db.refresh(therapy)
    return therapy
