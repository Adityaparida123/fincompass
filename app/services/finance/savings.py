"""Savings goal helpers."""

from decimal import Decimal

from app.db.mongo import Doc

RECOMMENDED_MONTHS = 6


def progress_percent(goal: Doc) -> Decimal:
    if goal.target_amount <= 0:
        return Decimal("0")
    value = (goal.current_amount / goal.target_amount) * Decimal("100")
    return value.quantize(Decimal("0.01"))


def goal_to_read(goal: Doc) -> dict:
    return {
        "id": goal.id,
        "name": goal.name,
        "target_amount": goal.target_amount,
        "current_amount": goal.current_amount,
        "target_date": goal.target_date,
        "status": goal.status,
        "progress_percent": progress_percent(goal),
    }
