"""Row-level validation for extracted transactions.

Parser and normalization already reject rows without a usable date/amount.
This stage flags *suspicious but recoverable* rows (future dates, implausibly
old dates, near-empty narrations) so the review screen can surface them.
"""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

_MAX_LOOKBACK_YEARS = 10


def validate_row(
    *,
    tx_date: date,
    amount: Decimal,
    description: str,
) -> list[str]:
    warnings: list[str] = []
    today = date.today()

    if tx_date > today:
        warnings.append("date_in_future")
    elif tx_date < today - timedelta(days=365 * _MAX_LOOKBACK_YEARS):
        warnings.append("date_very_old")

    if amount is not None and amount <= 0:
        warnings.append("non_positive_amount")

    text = (description or "").strip()
    if len(text) < 2 or (len(text) <= 2 and not text.isalnum()):
        warnings.append("ambiguous_description")

    return warnings
