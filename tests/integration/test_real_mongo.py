"""Real MongoDB integration tests.

These run ONLY when a real MongoDB is available via the environment variable
``FINCOMPASS_REAL_MONGO_URI`` (e.g. a local mongod or an Atlas test cluster):

    FINCOMPASS_REAL_MONGO_URI=mongodb://localhost:27017 pytest tests/integration/test_real_mongo.py -s

Without that variable the suite is skipped and reports MANUAL VERIFICATION
REQUIRED — it never silently pretends to test a real MongoDB.

The mongomock suite under tests/ covers behaviour; this module verifies driver
compatibility against the real MongoDB server (Decimal128 handling, index
creation, counters, ping) that mongomock cannot fully emulate.
"""

import os

import pytest

from app.db.mongo import MongoDatabase, PyMongoBackend, mongo_backend_from_database

_REAL_URI = os.environ.get("FINCOMPASS_REAL_MONGO_URI", "").strip()

pytestmark = pytest.mark.skipif(
    not _REAL_URI,
    reason=(
        "Real MongoDB integration tests require FINCOMPASS_REAL_MONGO_URI. "
        "MANUAL VERIFICATION REQUIRED against a real MongoDB/Atlas cluster."
    ),
)


@pytest.fixture(scope="module")
async def real_db():
    from pymongo.asynchronous.mongo_client import AsyncMongoClient

    client = AsyncMongoClient(_REAL_URI, serverSelectionTimeoutMS=5000)
    db = client["finai_real_mongo_test"]
    backend: PyMongoBackend = mongo_backend_from_database(db)
    yield MongoDatabase(backend)
    await db.drop_collection("transactions")
    await db.drop_collection("users")
    await db.drop_collection("readiness_factors")
    await client.close()


async def test_real_ping(real_db):
    assert await real_db.ping() is True


async def test_real_decimal128_round_trip(real_db):
    from decimal import Decimal

    inserted = await real_db.insert(
        "transactions",
        {"user_id": 1, "description": "real-mongo", "amount": Decimal("1234.56")},
    )
    fetched = await real_db.find_one("transactions", {"id": inserted.id})
    assert fetched.amount == Decimal("1234.56")
    assert type(fetched.amount).__name__ == "Decimal"


async def test_real_index_creation_and_idempotency(real_db):
    from app.db.indexes import ensure_indexes

    first = await ensure_indexes(real_db)
    second = await ensure_indexes(real_db)
    assert first == second


async def test_real_integer_id_counter(real_db):
    a = await real_db.insert("users", {"email": "real-a@example.com", "password_hash": "h"})
    b = await real_db.insert("users", {"email": "real-b@example.com", "password_hash": "h"})
    assert isinstance(a.id, int) and isinstance(b.id, int)
    assert a.id != b.id
