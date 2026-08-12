"""Shared fixtures for integration tests.

Tests run against an in-memory SQLite database so the suite is runnable
without a Postgres/Redis instance.
"""

import os
import tempfile

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("LLM_API_KEY", "")
os.environ.setdefault("LLM_MODEL", "")
os.environ.setdefault("LLM_BASE_URL", "")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base

_TEST_DB = os.path.join(tempfile.gettempdir(), "finai_test.sqlite3")

engine = create_async_engine(
    f"sqlite+aiosqlite:///{_TEST_DB}",
    connect_args={"check_same_thread": False},
)
SessionTest = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    if os.path.exists(_TEST_DB):
        os.remove(_TEST_DB)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with SessionTest() as session:
        from app.services.schemes.service import ensure_seed_schemes

        await ensure_seed_schemes(session)
        await session.commit()
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def _override_session():
    async with SessionTest() as session:
        yield session


@pytest.fixture
def app():
    from app.main import app as application

    application.dependency_overrides.clear()
    from app.db.session import get_session

    application.dependency_overrides[get_session] = _override_session
    return application


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    async with SessionTest() as session:
        yield session


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register a user and return auth headers."""
    response = await client.post(
        "/api/v1/auth/register",
        json={"full_name": "Test User", "email": "test@example.com", "password": "strong-password-123"},
    )
    assert response.status_code == 201
    token = response.json()["tokens"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def consented_headers(client, auth_headers):
    for ctype in ["financial_data_analysis", "personalized_recommendations", "chat_financial_context"]:
        response = await client.post("/api/v1/consent", json={"consent_type": ctype}, headers=auth_headers)
        assert response.status_code in (201, 200)
    return auth_headers
