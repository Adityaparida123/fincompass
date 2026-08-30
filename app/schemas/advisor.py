"""Advisory schemas: purchase affordability, what-if scenarios, smart UPI parsing."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class BaselineSnapshot(BaseModel):
    """A snapshot of the user's current averaged financial position."""

    income: Decimal | None
    total_expenses: Decimal | None
    essential_monthly_expenses: Decimal | None
    debt_payments: Decimal | None
    net_cash_flow: Decimal
    savings_balance: Decimal | None
    buffer_months: float | None
    savings_rate_percent: float | None
    health_score: int | None
    health_label: str | None


class PurchaseScenarioOut(BaseModel):
    key: str
    verdict: str
    headline: str
    detail: str
    monthly_impact: str | None = None
    months_to_save: int | None = None
    post_finance_cash_flow: Decimal | None = None
    health_score_after: int | None = None
    health_impact: str | None = None


class PurchaseAffordabilityResult(BaseModel):
    name: str | None = None
    amount: Decimal
    insufficient_data: bool
    missing_fields: list[str] = []
    overall_verdict: str
    overall_headline: str
    overall_detail: str
    baseline: BaselineSnapshot
    scenarios: list[PurchaseScenarioOut]
    disclaimer: str


class PurchaseAffordabilityRequest(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    monthly_benefit_income: Decimal | None = Field(default=None, ge=0, max_digits=16, decimal_places=2)
    financing_amount: Decimal | None = Field(default=None, ge=0, max_digits=16, decimal_places=2)
    financing_interest_rate: Decimal | None = Field(default=None, ge=0, le=100, max_digits=8, decimal_places=4)
    financing_tenure_months: int | None = Field(default=None, ge=1, le=120)


class ScenarioRequest(BaseModel):
    income_delta: Decimal = Field(default=Decimal("0"), max_digits=16, decimal_places=2)
    expenses_delta: Decimal = Field(default=Decimal("0"), max_digits=16, decimal_places=2)
    debt_delta: Decimal = Field(default=Decimal("0"), max_digits=16, decimal_places=2)
    savings_contribution: Decimal = Field(default=Decimal("0"), ge=0, max_digits=16, decimal_places=2)
    one_time_purchase: Decimal = Field(default=Decimal("0"), ge=0, max_digits=16, decimal_places=2)
    label: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def require_change(self) -> "ScenarioRequest":
        if (
            self.income_delta == 0
            and self.expenses_delta == 0
            and self.debt_delta == 0
            and self.savings_contribution == 0
            and self.one_time_purchase == 0
        ):
            raise ValueError("At least one scenario change must be provided.")
        return self


class WhyChange(BaseModel):
    factor: str
    label: str
    before: str
    after: str
    reason: str


class ScenarioSimulationResult(BaseModel):
    insufficient_data: bool
    missing_fields: list[str] = []
    label: str | None = None
    baseline: BaselineSnapshot
    scenario: BaselineSnapshot
    score_change: int
    risk_before: str
    risk_after: str
    why: list[WhyChange] = []
    disclaimer: str


class SmartParseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class SmartParseOut(BaseModel):
    parsed: bool
    message: str
    amount: Decimal | None = None
    transaction_type: str | None = None
    description: str | None = None
    amount_date: str | None = None
    category: str | None = None
    category_confidence: str | None = None
    needs_review: bool = True
    review_hint: str | None = None