"""Expense analysis routes (consented financial data)."""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user
from app.db.enums import ConsentType
from app.db.mongo import Doc, MongoDatabase
from app.db.session import get_session
from app.schemas.expense import (
    CategoryBreakdown,
    ExpenseSummary,
    ExpenseTrendPoint,
    ExpenseTrends,
)
from app.services.consent.service import require_consent
from app.services.finance.expenses import (
    category_totals,
    detect_recurring_patterns,
    expense_series,
    expense_totals,
    income_series,
    income_totals,
)
from app.utils.dates import month_bounds

router = APIRouter(prefix="/expenses", tags=["expenses"])

GRANULARITIES = {"day", "week", "month", "year"}


async def _ensure_consent(db: MongoDatabase, user_id: int) -> None:
    await require_consent(db, user_id, ConsentType.financial_data_analysis)


def _share(total: Decimal, grand_total: Decimal) -> Decimal:
    if grand_total <= 0:
        return Decimal("0")
    return (total / grand_total * Decimal("100")).quantize(Decimal("0.01"))


def _trend_direction(change: Decimal | None) -> str | None:
    if change is None:
        return None
    if change > 0:
        return "up"
    if change < 0:
        return "down"
    return "flat"


async def _enhanced_summary(
    db: MongoDatabase,
    user_id: int,
    start: date,
    end: date,
    *,
    prev_start: date | None = None,
    prev_end: date | None = None,
    include_daily: bool = False,
) -> dict:
    data = await _summary(db, user_id, start, end)
    prev_total = None
    change_pct = None
    if prev_start and prev_end:
        prev_total, _ = await expense_totals(db, user_id, prev_start, prev_end)
        if prev_total > 0:
            change_pct = ((data["total_expenses"] - prev_total) / prev_total * Decimal("100")).quantize(
                Decimal("0.01")
            )
    daily = None
    if include_daily:
        series = await expense_series(db, user_id, start, end, "day")
        daily = series
    recurring = await detect_recurring_patterns(db, user_id)
    insights: list[str] = []
    if change_pct is not None:
        insights.append(f"Expenses changed {change_pct}% vs previous period.")
    if recurring:
        insights.append(f"Detected {len(recurring)} likely recurring payment pattern(s).")
    return {
        **data,
        "previous_period_total": prev_total,
        "change_percent": change_pct,
        "trend_direction": _trend_direction(change_pct),
        "daily_breakdown": daily,
        "recurring_patterns": [p.model_dump(mode="json") for p in recurring],
        "insights": insights or None,
    }


def _build_expense_summary(period: str, data: dict) -> ExpenseSummary:
    cats = {cat: val for cat, val, _ in data["cats"]}
    return ExpenseSummary(
        period=period,
        total_expenses=data["total_expenses"],
        total_income=data["total_income"],
        net_cash_flow=data["total_income"] - data["total_expenses"],
        transaction_count=data["count"],
        categories=cats,
        previous_period_total=data.get("previous_period_total"),
        change_percent=data.get("change_percent"),
        trend_direction=data.get("trend_direction"),
        daily_breakdown=data.get("daily_breakdown"),
        recurring_patterns=data.get("recurring_patterns"),
        insights=data.get("insights"),
    )


async def _summary(db: MongoDatabase, user_id: int, start: date, end: date) -> dict:
    total_exp, count = await expense_totals(db, user_id, start, end)
    income = await income_totals(db, user_id, start, end)
    cats = await category_totals(db, user_id, start, end)
    return {
        "total_expenses": total_exp,
        "total_income": income,
        "count": count,
        "cats": cats,
    }


@router.get("/weekly", response_model=ExpenseSummary)
async def weekly(
    year: int = Query(..., ge=2000),
    week: int = Query(..., ge=1, le=53),
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ExpenseSummary:
    await _ensure_consent(db, user.id)
    iso = date.fromisocalendar(year, min(week, 52), 1)
    start = iso - timedelta(days=iso.weekday())
    end = start + timedelta(days=7)
    prev_end = start
    prev_start = prev_end - timedelta(days=7)
    data = await _enhanced_summary(
        db, user.id, start, end, prev_start=prev_start, prev_end=prev_end, include_daily=True
    )
    return _build_expense_summary(f"{year}-W{week:02d}", data)


@router.get("/monthly", response_model=ExpenseSummary)
async def monthly(
    period: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ExpenseSummary:
    await _ensure_consent(db, user.id)
    year, month = (int(p) for p in period.split("-"))
    start, end = month_bounds(year, month)
    if month == 1:
        prev_start, prev_end = month_bounds(year - 1, 12)
    else:
        prev_start, prev_end = month_bounds(year, month - 1)
    data = await _enhanced_summary(
        db, user.id, start, end, prev_start=prev_start, prev_end=prev_end, include_daily=True
    )
    return _build_expense_summary(period, data)


@router.get("/categories", response_model=list[CategoryBreakdown])
async def categories(
    start: date | None = None,
    end: date | None = None,
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> list[CategoryBreakdown]:
    await _ensure_consent(db, user.id)
    end = end or date.today()
    start = start or (end.replace(day=1) - timedelta(days=1)).replace(day=1)
    rows = await category_totals(db, user.id, start, end)
    grand = sum((val for _, val, _ in rows), Decimal("0"))
    return [
        CategoryBreakdown(
            category=cat,
            total=val,
            count=cnt,
            share_percent=_share(val, grand),
        )
        for cat, val, cnt in sorted(rows, key=lambda r: -r[1])
    ]


@router.get("/trends", response_model=ExpenseTrends)
async def trends(
    granularity: str = Query("month", pattern="^(day|week|month|year)$"),
    months: int = Query(6, ge=2, le=24),
    user: Doc = Depends(get_current_user),
    db: MongoDatabase = Depends(get_session),
) -> ExpenseTrends:
    await _ensure_consent(db, user.id)
    _, end = month_bounds(date.today().year, date.today().month)  # End of current month (e.g., 2026-09-01)
    start = date.today().replace(day=1)
    for _ in range(months - 1):
        prev = start - timedelta(days=1)
        start = prev.replace(day=1)
    series = await expense_series(db, user.id, start, end, granularity)
    inc = await income_series(db, user.id, start, end, granularity)
    ordered_keys = sorted(set(series.keys()) | set(inc.keys()))
    points: list[ExpenseTrendPoint] = []
    prev_total: Decimal | None = None
    for key in ordered_keys:
        total = series.get(key, Decimal("0"))
        change = None
        if prev_total is not None and prev_total != 0:
            change = ((total - prev_total) / prev_total * Decimal("100")).quantize(Decimal("0.01"))
        points.append(
            ExpenseTrendPoint(
                period=key,
                total=total,
                income=inc.get(key, Decimal("0")),
                previous=prev_total,
                change_percent=change,
            )
        )
        prev_total = total

    overall = None
    if len(points) >= 2:
        first_val = points[0].total
        if first_val != 0:
            overall = ((points[-1].total - first_val) / first_val * Decimal("100")).quantize(Decimal("0.01"))

    cats = await category_totals(db, user.id, start, end)
    grand = sum((val for _, val, _ in cats), Decimal("0"))
    top = [
        CategoryBreakdown(category=cat, total=val, count=cnt, share_percent=_share(val, grand))
        for cat, val, cnt in sorted(cats, key=lambda r: -r[1])[:5]
    ]
    return ExpenseTrends(
        granularity=granularity,
        points=points,
        overall_change_percent=overall,
        top_categories=top,
    )
