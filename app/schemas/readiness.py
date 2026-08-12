"""Credit readiness schemas."""

from pydantic import BaseModel


class ReadinessFactorOut(BaseModel):
    name: str
    impact: int
    direction: str
    explanation: str
    value: str | None = None


class ReadinessResult(BaseModel):
    score: int
    version: str
    factors: list[ReadinessFactorOut]
    summary: str


class ScoreCorrectionResult(BaseModel):
    previous_score: int
    updated_score: int
    changed_factors: list[ReadinessFactorOut]
    reason: str
    version: str
