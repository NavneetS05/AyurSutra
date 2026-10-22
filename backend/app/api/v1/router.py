from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    billing,
    consultations,
    patients,
    rooms,
    scheduling,
    staff,
    therapies,
    analytics,
    audit,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(patients.router)
api_router.include_router(therapies.router)
api_router.include_router(rooms.router)
api_router.include_router(staff.router)
api_router.include_router(consultations.router)
api_router.include_router(billing.router)
api_router.include_router(scheduling.router)
api_router.include_router(analytics.router)
api_router.include_router(audit.router)
