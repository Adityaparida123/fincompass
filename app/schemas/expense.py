"""Expense analysis schemas."""

from decimal import Decimal

from pydantic import BaseModel


class CategoryBreakdown(BaseModel):
    category: str
    total: Decimal
    count: int
    share_percent: Decimal


class ExpenseSummary(BaseModel):
    period: str
    total_expenses: Decimal
    total_income: Decimal
    net_cash_flow: Decimal
    transaction_count: int
    categories: dict[str, Decimal]
    previous_period_total: Decimal | None = None
    change_percent: Decimal | None = None
    trend_direction: str | None = None
    daily_breakdown: dict[str, Decimal] | None = None
    recurring_patterns: list[dict] | None = None
    insights: list[str] | None = None


class ExpenseTrendPoint(BaseModel):
    period: str
    total: Decimal
    previous: Decimal | None = None
    change_percent: Decimal | None = None


class ExpenseTrends(BaseModel):
    granularity: str
    points: list[ExpenseTrendPoint]
    overall_change_percent: Decimal | None = None
    top_categories: list[CategoryBreakdown]
