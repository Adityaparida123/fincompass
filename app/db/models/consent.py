"""Consent model for data-usage authorizations."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin
from app.db.enums import ConsentStatus, ConsentType

__all__ = ["Consent", "ConsentStatus", "ConsentType"]


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
