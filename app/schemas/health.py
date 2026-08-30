"""Financial Health Score schemas.

The financial health score is an internal, explainable composite of the
user's recorded financial data. It is explicitly NOT a credit score and the
API always exposes ``is_credit_score=False`` so clients never mislabel it.
"""

from pydantic import BaseModel


class FinancialHealthFactor(BaseModel):
    name: str
    score: int
    weight: float
    direction: str  # "positive" | "negative" | "neutral"
    explanation: str
    value: str | None = None


class FinancialHealthResult(BaseModel):
    score: int
    label: str
    version: str
    factors: list[FinancialHealthFactor]
    summary: str
    insufficient_data: bool = False
    is_credit_score: bool = False
    previous_score: int | None = None
    change: int | None = None
