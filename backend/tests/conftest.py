import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db.session import Base, get_db
from app.main import app

# Shared in-memory SQLite database across all integration tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_test_schema():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db():
    session = TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_user(db):
    from app.models import User, UserRole, Staff
    from app.core.security import hash_password
    admin = db.query(User).filter(User.role == UserRole.admin).first()
    if not admin:
        admin = User(
            email="admin_shared@test.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.admin,
            is_active=True,
            is_online=True,
        )
        db.add(admin)
        db.flush()
        staff = Staff(
            user_id=admin.id,
            first_name="Admin",
            last_name="Shared",
            qualification="BAMS",
            is_doctor=False,
            is_therapist=False,
        )
        db.add(staff)
        db.commit()
        db.refresh(admin)
    return admin


@pytest.fixture
def admin_headers(admin_user):
    from app.core.security import create_access_token
    token = create_access_token(subject=admin_user.id, role="admin")
    return {"Authorization": f"Bearer {token}"}

