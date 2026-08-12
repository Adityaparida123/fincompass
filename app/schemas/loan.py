"""Loan simulation schemas."""

from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class EMICalculateRequest(BaseModel):
    principal: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    annual_interest_rate: Decimal = Field(ge=0, max_digits=8, decimal_places=4)
    tenure_months: int = Field(gt=0, le=600)

    @model_validator(mode="after")
    def validate_inputs(self) -> "EMICalculateRequest":
        if self.principal <= 0:
            raise ValueError("principal must be greater than zero.")
        if self.annual_interest_rate < 0:
            raise ValueError("annual_interest_rate must be zero or greater.")
        if self.tenure_months <= 0:
            raise ValueError("tenure_months must be greater than zero.")
        return self


class EMIResult(BaseModel):
    principal: Decimal
    annual_interest_rate: Decimal
    tenure_months: int
    monthly_emi: Decimal
    total_interest: Decimal
    total_payment: Decimal
    zero_interest: bool


class LoanSimulationRequest(BaseModel):
    income: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    monthly_expenses: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    existing_debt_payment: Decimal = Field(ge=0, max_digits=16, decimal_places=2)
    loan_amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    interest_rate: Decimal = Field(ge=0, max_digits=8, decimal_places=4)
    tenure_months: int = Field(gt=0, le=600)


class LoanAlternative(BaseModel):
    type: str
    title: str
    description: str


class LoanSimulationResult(BaseModel):
    emi: Decimal
    cash_flow_before: Decimal
    cash_flow_after: Decimal
    debt_burden_before: Decimal
    debt_burden_after: Decimal
    affordability_ratio: Decimal
    warnings: list[str]
    alternatives: list[LoanAlternative]
    assumptions: list[str]
    recommendation: str


class AffordabilityInput(BaseModel):
    income: Decimal = Field(gt=0)
    monthly_expenses: Decimal = Field(ge=0)
    existing_debt_payment: Decimal = Field(ge=0)
    proposed_emi: Decimal = Field(ge=0)


class AffordabilityResult(BaseModel):
    disposable_cash_flow: Decimal
    post_loan_cash_flow: Decimal
    debt_burden_with_loan: Decimal
    is_affordable: bool
    note: str
