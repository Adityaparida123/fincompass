"""Unit tests for bulk ID allocation and insertion."""

from datetime import date
from decimal import Decimal

import pytest

from app.db.mongo import MongoDatabase, MongoMockBackend


def _db() -> MongoDatabase:
    import mongomock

    return MongoDatabase(MongoMockBackend(mongomock.MongoClient().finai_test))


@pytest.mark.asyncio
async def test_next_ids_allocates_sequential_unique_ids():
    db = _db()
    first = await db.next_ids("transactions", 3)
    second = await db.next_ids("transactions", 2)
    assert first == [1, 2, 3]
    assert second == [4, 5]
    assert not (set(first) & set(second))


@pytest.mark.asyncio
async def test_next_ids_zero_returns_empty():
    db = _db()
    assert await db.next_ids("transactions", 0) == []
    assert await db.next_ids("transactions", -1) == []


async def test_insert_many_empty_is_noop(db_session):
    assert await db_session.insert_many("transactions", []) == []


async def test_insert_many_assigns_ids_and_persists(db_session):
    docs = [
        {
            "user_id": 5,
            "date": date(2026, 8, 1),
            "description": "Swiggy",
            "amount": Decimal("450.00"),
            "transaction_type": "expense",
            "category": "food",
            "merchant": "Swiggy",
            "source": "import",
            "is_deleted": False,
        },
        {
            "user_id": 5,
            "date": date(2026, 8, 2),
            "description": "Salary credit",
            "amount": Decimal("45000.00"),
            "transaction_type": "income",
            "category": "income",
            "source": "import",
            "is_deleted": False,
        },
    ]
    inserted = await db_session.insert_many("transactions", docs)
    assert len(inserted) == 2
    assert inserted[0].id == 1
    assert inserted[1].id == 2

    found = await db_session.find("transactions", {"user_id": 5})
    assert len(found) == 2
    assert found[0].amount == Decimal("450.00")
    assert found[0].merchant == "Swiggy"
    assert found[1].date == "2026-08-02"


async def test_insert_then_insert_many_keep_counter_consistent(db_session):
    await db_session.insert("transactions", {"user_id": 1, "amount": Decimal("1.00")})
    batch = await db_session.insert_many("transactions", [{"user_id": 1, "amount": Decimal("2.00")}])
    assert batch[0].id == 2
    following = await db_session.insert("transactions", {"user_id": 1, "amount": Decimal("3.00")})
    assert following.id == 3
