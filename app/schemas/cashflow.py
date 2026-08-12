"""Cash flow schemas."""

from decimal import Decimal

from pydantic import BaseModel, Field


class CashFlowInput(BaseModel):
    income: Decimal = Field(gt=0)
    essential_expenses: Decimal = Field(ge=0)
    discretionary_expenses: Decimal = Field(ge=0)
    debt_payments: Decimal = Field(ge=0)


class CashFlowResult(BaseModel):
    income: Decimal
    essential_expenses: Decimal
    discretionary_expenses: Decimal
    debt_payments: Decimal
    total_outflow: Decimal
    available_cash_flow: Decimal
    is_positive: bool


class SavingsCapacityInput(BaseModel):
    income: Decimal = Field(gt=0)
    expenses: Decimal = Field(ge=0)
    debt_payments: Decimal = Field(ge=0)


class SavingsCapacityResult(BaseModel):
    estimated_monthly_savings: Decimal
    savings_rate: Decimal
    is_estimate: bool = True
    note: str = (
        "This is an estimate based on reported income and expenses. "
        "Actual savings depend on unforeseen expenses and spending variability."
    )
