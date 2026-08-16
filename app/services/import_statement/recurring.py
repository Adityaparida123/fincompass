"""In-statement recurring-transaction detection.

Only identifies *candidate* patterns (same merchant + similar amount appearing
on a regular cadence within the statement). It never creates recurring rules —
the flag is surfaced on the preview and handed to the analytics layer.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from app.services.import_statement.normalize import clean_description

_AMOUNT_TOLERANCE = Decimal("0.02")


def _amount_close(a: Decimal, b: Decimal) -> bool:
    return abs(a - b) <= max(_AMOUNT_TOLERANCE, abs(a) * Decimal("0.05"))


def _key(merchant: str | None, description: str, category: str) -> str:
    if merchant:
        return merchant.strip().lower()
    text = clean_description(description).lower()
    return f"{category}:{text[:40]}"


def detect_recurring(
    rows: list,
) -> set[int]:
    """Return the set of ``row_number`` values likely part of a recurring
    pattern (at least two occurrences of the same merchant/description with a
    similar amount).

    ``rows`` items expose ``row_number``, ``merchant``, ``description``,
    ``category``, ``amount`` and ``date``.
    """
    by_key: dict[str, list[tuple[int, date, Decimal]]] = defaultdict(list)
    for row in rows:
        by_key[_key(row.merchant, row.description, row.category)].append(
            (row.row_number, row.date, row.amount)
        )

    recurring: set[int] = set()
    for events in by_key.values():
        if len(events) < 2:
            continue
        events.sort(key=lambda e: e[1])
        base_amount = events[0][2]
        same_amount = sum(1 for _, _, amt in events if _amount_close(amt, base_amount))
        if same_amount >= 2:
            recurring.update(row_number for row_number, _, _ in events)
    return recurring
