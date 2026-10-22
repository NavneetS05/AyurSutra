from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User, UserRole

bearer = HTTPBearer()


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Offline lockout enforcement:
    # If account is offline, only presence endpoints (to mark online) and profile checks are allowed
    path = request.url.path
    allowed_offline_paths = (
        "/users/me/presence",
        "/auth/me",
        "/auth/logout",
    )
    if user.role != UserRole.patient and getattr(user, "is_online", True) is False:
        if not any(path.endswith(p) for p in allowed_offline_paths):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is currently offline. Please mark your account online to access features.",
            )

    return user


def require_roles(*roles: UserRole):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in roles]}",
            )
        return current_user
    return checker


# Convenience role dependencies
AdminOnly = Depends(require_roles(UserRole.admin))
AdminOrReceptionist = Depends(require_roles(UserRole.admin, UserRole.receptionist))
DoctorAdminOrReceptionist = Depends(require_roles(UserRole.admin, UserRole.doctor, UserRole.receptionist))
DoctorOnly = Depends(require_roles(UserRole.doctor))
TherapistOnly = Depends(require_roles(UserRole.therapist))
StaffOnly = Depends(require_roles(UserRole.admin, UserRole.receptionist, UserRole.doctor, UserRole.therapist))
AnyRole = Depends(get_current_user)

bearer_optional = HTTPBearer(auto_error=False)


def get_current_user_flexible(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_optional),
    db: Session = Depends(get_db),
) -> User:
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif request.query_params.get("token"):
        raw_token = request.query_params.get("token")

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required via header or ?token= query parameter",
        )

    payload = decode_token(raw_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


AnyRoleFlexible = Depends(get_current_user_flexible)

