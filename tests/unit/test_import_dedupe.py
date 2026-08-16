"""Unit tests for duplicate fingerprinting."""

from datetime import date
from decimal import Decimal

from app.db.mongo import MongoDatabase, MongoMockBackend
from app.services.import_statement.dedupe import (
    ExistingIndex,
    fingerprint,
    load_existing_fingerprints,
    mark_duplicates,
)


def _db() -> MongoDatabase:
    import mongomock

    return MongoDatabase(MongoMockBackend(mongomock.MongoClient().finai_test))


def test_fingerprint_deterministic():
    a = fingerprint(1, date(2026, 8, 1), Decimal("350.00"), "  Zomato   Order ", "expense")
    b = fingerprint(1, date(2026, 8, 1), Decimal("350.00"), "zomato order", "expense")
    assert a == b


def test_fingerprint_differs_on_fields():
    base = (1, date(2026, 8, 1), Decimal("350.00"), "Zomato", "expense")
    assert fingerprint(*base) != fingerprint(2, *base[1:])
    assert fingerprint(*base) != fingerprint(*base[:2], Decimal("351.00"), *base[3:])
    assert fingerprint(*base) != fingerprint(*base[:3], "Swiggy", "expense")
    assert fingerprint(*base) != fingerprint(*base[:4], "income")


async def test_load_existing_fingerprints(db_session):
    await db_session.insert(
        "transactions",
        {
            "user_id": 7,
            "date": date(2026, 8, 1),
            "description": "Zomato",
            "amount": Decimal("350.00"),
            "transaction_type": "expense",
            "category": "food",
            "source": "import",
            "is_deleted": False,
        },
    )
    fps = await load_existing_fingerprints(db_session, 7)
    assert len(fps) == 1
    assert (
        fingerprint(7, date(2026, 8, 1), Decimal("350.00"), "zomato", "expense") in fps
    )
    assert len(await load_existing_fingerprints(db_session, 8)) == 0


class _Preview:
    def __init__(self, date, amount, description, transaction_type, reference=None):
        self.date = date
        self.amount = amount
        self.description = description
        self.transaction_type = transaction_type
        self.reference = reference
        self.is_duplicate = False
        self.duplicate_status = "new"


def test_mark_duplicates_within_statement():
    rows = [
        _Preview(date(2026, 8, 1), Decimal("100.00"), "A", "expense"),
        _Preview(date(2026, 8, 1), Decimal("100.00"), "A", "expense"),
        _Preview(date(2026, 8, 1), Decimal("200.00"), "B", "expense"),
    ]
    rows, count = mark_duplicates(rows, set(), 1)
    assert count == 1
    assert rows[1].is_duplicate is True
    assert rows[0].is_duplicate is False
    assert rows[2].is_duplicate is False


def test_mark_duplicates_against_existing():
    existing = {fingerprint(1, date(2026, 8, 1), Decimal("100.00"), "A", "expense")}
    rows = [_Preview(date(2026, 8, 1), Decimal("100.00"), "A", "expense")]
    rows, count = mark_duplicates(rows, existing, 1)
    assert count == 1
    assert rows[0].is_duplicate is True
    assert rows[0].duplicate_status == "duplicate"


def test_possible_duplicate_same_day_same_amount_different_desc():
    rows = [
        _Preview(date(2026, 8, 1), Decimal("500.00"), "UPI DR SWIGGY", "expense"),
        _Preview(date(2026, 8, 1), Decimal("500.00"), "UPI DR ZOMATO", "expense"),
    ]
    rows, count = mark_duplicates(rows, set(), 1)
    assert count == 0
    assert rows[0].duplicate_status == "new"
    assert rows[1].duplicate_status == "possible_duplicate"
    assert rows[1].is_duplicate is False


def test_possible_duplicate_same_desc_same_amount_within_window():
    rows = [
        _Preview(date(2026, 8, 1), Decimal("649.00"), "NETFLIX", "expense"),
        _Preview(date(2026, 8, 3), Decimal("649.00"), "NETFLIX", "expense"),
    ]
    rows, _ = mark_duplicates(rows, set(), 1)
    assert rows[1].duplicate_status == "possible_duplicate"


def test_not_possible_when_dates_far_apart():
    rows = [
        _Preview(date(2026, 1, 1), Decimal("649.00"), "NETFLIX", "expense"),
        _Preview(date(2026, 8, 1), Decimal("649.00"), "NETFLIX", "expense"),
    ]
    rows, _ = mark_duplicates(rows, set(), 1)
    assert rows[1].duplicate_status == "new"


def test_possible_against_existing_index():
    index = ExistingIndex()
    index.exact.add(fingerprint(1, date(2026, 7, 1), Decimal("800.00"), "DMART", "expense"))
    index.add(date(2026, 7, 1), Decimal("800.00"), "DMART")
    rows = [_Preview(date(2026, 7, 3), Decimal("800.00"), "DMART", "expense")]
    rows, _ = mark_duplicates(rows, index, 1)
    assert rows[0].duplicate_status == "possible_duplicate"


def test_possible_same_day_different_desc_against_existing_index():
    index = ExistingIndex()
    index.add(date(2026, 8, 1), Decimal("900.00"), "BIGBASKET")
    rows = [_Preview(date(2026, 8, 1), Decimal("900.00"), "BLINKIT", "expense")]
    rows, _ = mark_duplicates(rows, index, 1)
    assert rows[0].duplicate_status == "possible_duplicate"
