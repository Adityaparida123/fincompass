"""Credit readiness schemas."""

from pydantic import BaseModel
from decimal import Decimal


class ReadinessFactorOut(BaseModel):
    name: str
    impact: int
    direction: str
    explanation: str
    value: str | None = None


class CashFlowAnalysis(BaseModel):
    """CFO/CFI/CFF cash flow statement analysis."""
    cfo: Decimal = Decimal("0")
    cfi: Decimal = Decimal("0")
    cff: Decimal = Decimal("0")
    cfo_explanation: str = ""
    cfi_explanation: str = ""
    cff_explanation: str = ""


class ReadinessResult(BaseModel):
    score: int
    version: str
    factors: list[ReadinessFactorOut]
    summary: str
    insufficient_data: bool = False
    cash_flow_analysis: CashFlowAnalysis | None = None


class ScoreCorrectionResult(BaseModel):
    previous_score: int
    updated_score: int
    changed_factors: list[ReadinessFactorOut]
    reason: str
    version: str
