"""Consent model for data-usage authorizations."""

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class ConsentType(str, Enum):
    financial_data_analysis = "financial_data_analysis"
    personalized_recommendations = "personalized_recommendations"
    chat_financial_context = "chat_financial_context"


class ConsentStatus(str, Enum):
    granted = "granted"
    revoked = "revoked"


class Consent(IdMixin, TimestampMixin, Base):
    __tablename__ = "consents"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    consent_type: Mapped[ConsentType] = mapped_column(
        SqlEnum(ConsentType, name="consent_type"), index=True, nullable=False
    )
    status: Mapped[ConsentStatus] = mapped_column(
        SqlEnum(ConsentStatus, name="consent_status"), default=ConsentStatus.granted, nullable=False
    )
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
