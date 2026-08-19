"""Shared fixtures for integration tests.

Tests run against an in-memory mongomock database behind the Mongo facade so
the suite is runnable without a MongoDB instance.
"""

import os

# Must be set BEFORE any app import so the settings singleton (cached at first
# app.core.config import) picks up test values instead of the repo .env file.
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("RATE_LIMIT_ENABLED", "false")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key")
os.environ.setdefault("LLM_API_KEY", "")
os.environ.setdefault("LLM_MODEL", "")
os.environ.setdefault("LLM_BASE_URL", "")
os.environ.setdefault(
    "CORS_ORIGINS", "http://localhost:3000,https://fincompass-three.vercel.app"
)

import mongomock
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.db.mongo import MongoDatabase, MongoMockBackend, set_database


def _fresh_db() -> MongoDatabase:
    client = mongomock.MongoClient()
    return MongoDatabase(MongoMockBackend(client.finai_test))


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    db = _fresh_db()
    set_database(db)
    from app.services.schemes.service import ensure_seed_schemes

    await ensure_seed_schemes(db)
    return db


async def _override_session():
    from app.db.mongo import get_database

    db = get_database()
    if db is None:
        db = _fresh_db()
        set_database(db)
    yield db


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
    from app.db.mongo import get_database

    yield get_database()


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
    for ctype in [
        "financial_data_analysis",
        "personalized_recommendations",
        "chat_financial_context",
        "ml_analysis",
    ]:
        response = await client.post("/api/v1/consent", json={"consent_type": ctype}, headers=auth_headers)
        assert response.status_code in (201, 200)
    return auth_headers
