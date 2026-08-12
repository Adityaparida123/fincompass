"""Consent schemas."""

from datetime import datetime

from pydantic import BaseModel

from app.db.models.consent import ConsentType


class ConsentGrantRequest(BaseModel):
    consent_type: ConsentType
    version: int = 1


class ConsentRead(BaseModel):
    consent_type: ConsentType
    status: str
    granted_at: datetime | None = None
    revoked_at: datetime | None = None
    version: int

    model_config = {"from_attributes": True}


class ConsentList(BaseModel):
    items: list[ConsentRead]
