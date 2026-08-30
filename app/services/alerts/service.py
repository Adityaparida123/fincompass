"""Proactive financial alert generation.

Generates alerts ONLY from the user's actual recorded data. No fabricated
or speculative alerts ever. Alerts are stored as notifications with type
"alert" so they use the existing read/dismiss lifecycle and dedupe window.

Rules (all deterministic, all data-backed):

  1. Cash-flow health: negative monthly surplus, or a cash buffer below 3
     months of essential expenses.
  2. Category spike: a spending category is up >= 25% and >= Rs 300 in the
     latest complete month vs the average of the two prior months.
  3. Saving opportunity: monthly surplus rate is low (< 10%) while a
     discretionary category is trending up.
  4. Recurring obligations: rent/EMI/utility-type payments detected on a
     near-monthly cadence that do not yet appear in the current month.
"""

from datetime import date
from decimal import Decimal

from app.db.mongo import MongoDatabase
from app.services.finance.simulator import build_snapshot
from app.services.notifications.service import notify
from app.services.readiness.engine import ReadinessInput
from app.services.finance.expenses import detect_recurring_patterns

ZERO = Decimal("0")
ALERT_TYPE = "alert"

_SPIKE_MIN_MULTIPLIER = Decimal("1.25")
_SPIKE_MIN_DELTA = Decimal("300")
_LOW_BUFFER_MONTHS = 3
_MAX_ALERTS = 4


async def generate_alerts(db: MongoDatabase, user_id: int) -> int:
    """Run all alert checks and persist new alerts (deduplicated).

    Returns the number of alerts actually created in this pass.
    """
    base = await _current_readiness(db, user_id)
    checks: list[str] = []

    if base is not None:
        checks += await _cashflow_alerts(db, user_id, base)
        checks += await _category_alerts(db, user_id, base)
        checks += await _savings_alerts(db, user_id, base)
    checks += await _recurring_alerts(db, user_id)

    created = 0
    for alert in checks[: _MAX_ALERTS]:
        result = await notify(
            db,
            user_id,
            alert["title"],
            alert["message"],
            ALERT_TYPE,
            dedupe_window_minutes=alert.get("dedupe_minutes", 1440),
        )
        if result is not None:
            created += 1
    return created


async def _current_readiness(db: MongoDatabase, user_id: int) -> ReadinessInput | None:
    try:
        from app.services.readiness.factors import build_readiness_input

        return await build_readiness_input(db, user_id)
    except Exception:  # noqa: BLE001 - alerts must never crash on data issues
        return None


async def _cashflow_alerts(db: MongoDatabase, user_id: int, base: ReadinessInput) -> list[dict]:
    snapshot = build_snapshot(base)
    alerts: list[dict] = []

    if snapshot.net_cash_flow < ZERO:
        alerts.append(
            {
                "title": "Monthly spending exceeds income",
                "message": (
                    f"Your average income ({snapshot.income or 0:,.2f}/mo) and total obligations "
                    f"(expenses {snapshot.total_expenses or 0:,.2f} + debt {snapshot.debt_payments or 0:,.2f}) "
                    f"leave a monthly shortfall of {-snapshot.net_cash_flow:,.2f}. "
                    "Even a small negative balance adds up fast — trim discretionary spending first."
                ),
                "dedupe_minutes": 60 * 24,
            }
        )
    elif snapshot.buffer_months is not None and snapshot.buffer_months < _LOW_BUFFER_MONTHS:
        alerts.append(
            {
                "title": "Cash buffer is below 3 months",
                "message": (
                    f"Your savings cover about {snapshot.buffer_months:.1f} months of essential expenses. "
                    "Aim for 3-6 months so unexpected costs do not force borrowing."
                ),
                "dedupe_minutes": 60 * 24 * 7,
            }
        )
    return alerts


async def _monthly_category_totals(db: MongoDatabase, user_id: int) -> dict[str, dict[str, Decimal]]:
    """map[YYYY-MM] -> map[category] -> total, over the last 3 months."""
    end = date.today()
    months: dict[str, dict[str, Decimal]] = {}
    for i in range(3):
        year, month = _month_before(end, i)
        months[f"{year:04d}-{month:02d}"] = {}
    oldest_year, oldest_month = _month_before(end, 2)
    filt = {
        "user_id": user_id,
        "transaction_type": "expense",
        "is_deleted": False,
        "date": {"$gte": date(oldest_year, oldest_month, 1)},
    }
    for row in await db.find("transactions", filt):
        key = row.date[:7]
        if key in months:
            months[key][row.category] = months[key].get(row.category, ZERO) + row.amount
    return months


def _month_before(d: date, n: int) -> tuple[int, int]:
    year, month = d.year, d.month
    for _ in range(n):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return year, month


async def _category_alerts(db: MongoDatabase, user_id: int, base: ReadinessInput) -> list[dict]:
    months = await _monthly_category_totals(db, user_id)
    ordered = sorted(months.keys())
    if len(ordered) < 3:
        return []
    latest_key, mid_key, old_key = ordered[-1], ordered[-2], ordered[-3]
    latest = months[latest_key]
    base_two = {c: months[mid_key].get(c, ZERO) + months[old_key].get(c, ZERO) for c in set(months[mid_key]) | set(months[old_key])}

    alerts: list[dict] = []
    for category, current in latest.items():
        total_prior = base_two.get(category, ZERO)
        if total_prior <= ZERO or current <= 0:
            continue
        avg_prior = total_prior / Decimal(2)
        if current >= avg_prior * _SPIKE_MIN_MULTIPLIER and (current - avg_prior) >= _SPIKE_MIN_DELTA:
            alerts.append(
                {
                    "title": f"Spending spike: {category}",
                    "message": (
                        f"Spending on {category} this month ({current:,.2f}) is up {((current - avg_prior) / avg_prior * 100):.0f}% "
                        f"vs your two-month average of {avg_prior:,.2f}. Check for a recurring charge or a one-off you can smooth out."
                    ),
                    "dedupe_minutes": 60 * 24,
                }
            )
    return alerts


async def _savings_alerts(db: MongoDatabase, user_id: int, base: ReadinessInput) -> list[dict]:
    if base.income <= ZERO:
        return []
    snapshot = build_snapshot(base)
    surplus_rate = snapshot.savings_rate_percent
    if surplus_rate is None or surplus_rate >= 10.0:
        return []
    spikes = await _category_alerts(db, user_id, base)
    if not spikes:
        return []
    top_spike_category = spikes[0]["title"].replace("Spending spike: ", "")
    return [
        {
            "title": "Saving opportunity",
            "message": (
                f"Your monthly surplus is only about {surplus_rate:.1f}% of income. "
                f"The rise in '{top_spike_category}' spending is a good place to start — a 10% cut could add a few "
                "thousand rupees a year to your savings."
            ),
            "dedupe_minutes": 60 * 24 * 7,
        }
    ]


async def _recurring_alerts(db: MongoDatabase, user_id: int) -> list[dict]:
    today = date.today()
    patterns = await detect_recurring_patterns(db, user_id)
    # Only near-monthly, high-confidence patterns that have not happened yet this calendar month.
    unpaid = [
        p for p in patterns if p.interval_days is not None and 20 <= p.interval_days <= 45 and p.confidence == "high"
    ]
    if not unpaid:
        return []
    this_month_prefix = today.isoformat()[:7]
    done = await _categories_paid_this_month(db, user_id, this_month_prefix)
    missing = [p for p in unpaid if p.category not in done]
    alerts: list[dict] = []
    for pattern in missing[:2]:
        typical = pattern.typical_amount
        if typical <= ZERO:
            continue
        alerts.append(
            {
                "title": f"{pattern.label.title()} payment is due soon",
                "message": (
                    f"You typically pay around {typical:,.2f} for {pattern.label} every month "
                    f"({pattern.occurrences}x in the last 120 days) and it is not recorded yet this month. "
                    "Keep it tracked so it does not sneak up on your cash flow."
                ),
                "dedupe_minutes": 60 * 24 * 7,
            }
        )
    return alerts


async def _categories_paid_this_month(db: MongoDatabase, user_id: int, month_prefix: str) -> set[str]:
    filt = {
        "user_id": user_id,
        "transaction_type": "expense",
        "is_deleted": False,
        "date": {"$gte": f"{month_prefix}-01", "$lt": f"{month_prefix}-32"},
    }
    return {row.category for row in await db.find("transactions", filt)}