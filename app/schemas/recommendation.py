"""Recommendation schemas."""

from pydantic import BaseModel, Field


class RecommendationOut(BaseModel):
    type: str
    priority: int = Field(ge=1)
    title: str
    reason: str


class RecommendationsResult(BaseModel):
    recommendations: list[RecommendationOut]
    generated_at: str


class SummarySection(BaseModel):
    label: str
    value: str
    detail: str | None = None


class FinancialSummary(BaseModel):
    period: str
    income: str
    expenses: str
    available_cash_flow: str
    savings_rate_percent: str
    emergency_months_covered: str
    debt_payment_ratio_percent: str
    credit_readiness: int | None = None
    sections: list[SummarySection]
