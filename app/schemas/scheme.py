"""Government scheme schemas."""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class SchemeMatchInput(BaseModel):
    income: Decimal | None = Field(default=None, ge=0)
    age: int | None = Field(default=None, ge=0, le=130)
    location_state: str | None = None
    occupation: str | None = None
    gender: str | None = None
    special_eligibility: list[str] = Field(default_factory=list)


class SchemeRead(BaseModel):
    id: int
    name: str
    description: str
    jurisdiction: str
    eligibility: str
    benefits: str
    source_url: str | None
    last_verified: date | None
    active: bool

    model_config = {"from_attributes": True}


class SchemeMatch(BaseModel):
    scheme: SchemeRead
    match_reason: str
    confidence: str = "potential"  # potential | official
    disclaimer: str = (
        "This indicates potential eligibility only. Verify with the official source. "
        "FinAI does not guarantee eligibility for any scheme."
    )


class SchemeMatchResult(BaseModel):
    matches: list[SchemeMatch]
