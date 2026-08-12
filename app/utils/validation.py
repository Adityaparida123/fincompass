"""Input validation helpers shared across services."""

from datetime import date
from decimal import Decimal, InvalidOperation

from app.core.exceptions import InvalidInputError


def parse_decimal(value: object, field: str) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise InvalidInputError(f"Field '{field}' must be a valid decimal number.") from exc


def require_positive(value: Decimal, field: str) -> None:
    if value <= 0:
        raise InvalidInputError(f"Field '{field}' must be greater than zero.")


def require_non_negative(value: Decimal, field: str) -> None:
    if value < 0:
        raise InvalidInputError(f"Field '{field}' must be zero or greater.")


def parse_date(value: str | None, field: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise InvalidInputError(f"Field '{field}' must be a valid ISO date (YYYY-MM-DD).") from exc
