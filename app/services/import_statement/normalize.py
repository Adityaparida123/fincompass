"""Normalization helpers for raw bank-statement cells.

Amounts are hard to parse across Indian, Western and European conventions
(``1,23,456.78``, ``1,234.56``, ``1.234,56``). Dates appear in many formats.
All helpers are pure and unit-tested.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.schemas.import_statement import MAX_IMPORT_ROWS

_AMOUNT_STRIP_RE = re.compile(r"[^\d.,]", re.UNICODE)

_DATE_FORMATS = (
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%d.%m.%Y",
    "%Y-%m-%d",
    "%Y/%m/%d",
    "%d-%m-%y",
    "%d/%m/%y",
    "%d.%m.%y",
    "%d %b %Y",
    "%d %B %Y",
    "%d-%b-%Y",
    "%d/%b/%Y",
    "%d %b. %Y",
    "%d %B, %Y",
    "%d %b %y",
    "%b %d, %Y",
    "%B %d, %Y",
    "%b. %d, %Y",
    "%d-%b-%y",
    "%d %m %Y",
    "%d.%b.%Y",
)

_DEBIT_TOKENS = re.compile(r"\b(DR|DB|DEBIT|DEBITED|WD|WITHDRAWAL|WITHDRAWALS)\b", re.IGNORECASE)
_CREDIT_TOKENS = re.compile(r"\b(CR|CD|DEPOSIT|DEPOSITED|CREDITED)\b", re.IGNORECASE)


def clean_description(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text[:500]


def _normalize_separators(s: str) -> str:
    """Resolve ambiguous thousands/decimal separators to a plain decimal."""
    s = s.replace("\u00a0", "").replace(" ", "")
    if "." in s and "," in s:
        if s.rfind(",") > s.rfind("."):
            # Comma is the decimal separator (European: "1.234,56").
            return s.replace(".", "").replace(",", ".")
        # Dot is the decimal separator (Indian/Western: "1,23,456.78").
        return s.replace(",", "")
    if "," in s:
        last_comma = s.rfind(",")
        tail = s[last_comma + 1 :]
        if tail.isdigit() and len(tail) in (1, 2):
            # Single trailing comma with 1-2 digits = decimal separator.
            return s.replace(",", ".")
        return s.replace(",", "")
    if "." in s:
        parts = s.split(".")
        if len(parts) == 2:
            # A single dot is always the decimal separator.
            return s
        if len(parts) > 2 and len(parts[-1]) in (1, 2):
            # Multiple dots: last one (1-2 digits) is the decimal.
            return "".join(parts[:-1]) + "." + parts[-1]
        return s.replace(".", "")
    return s


def parse_amount(value) -> Decimal | None:
    """Parse an amount cell (may carry Dr/Cr suffixes, parens or a minus)."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    negative = bool(_DEBIT_TOKENS.search(text))
    if _CREDIT_TOKENS.search(text):
        negative = False
    if text.startswith("-"):
        negative = True
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1]

    digits = _AMOUNT_STRIP_RE.sub("", text.replace("+", "").replace("-", ""))
    if not any(ch.isdigit() for ch in digits):
        return None
    digits = _normalize_separators(digits)
    try:
        amount = Decimal(digits)
    except InvalidOperation:
        return None
    if amount <= 0:
        return None
    amount = amount.quantize(Decimal("0.01"))
    return -amount if negative else amount


def parse_date(value) -> date | None:
    """Parse a date cell across common Indian bank-statement formats."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    try:
        from dateutil import parser as dparser

        return dparser.parse(text, dayfirst=True).date()
    except Exception:
        return None


def normalize_reference(value) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = re.sub(r"\s+", " ", text)
    return text[:100]


def enforce_row_limit(total_rows: int) -> None:
    from app.core.exceptions import InvalidInputError

    if total_rows > MAX_IMPORT_ROWS:
        raise InvalidInputError(
            f"The statement contains more than {MAX_IMPORT_ROWS} transactions. "
            "Please split it into smaller periods and import them separately."
        )
