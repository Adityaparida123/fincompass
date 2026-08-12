"""Government scheme reference data model."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class GovernmentScheme(IdMixin, TimestampMixin, Base):
    __tablename__ = "government_schemes"

    name: Mapped[str] = mapped_column(String(300), index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(100), default="IN", index=True, nullable=False)
    eligibility: Mapped[str] = mapped_column(Text, nullable=False)
    benefits: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_verified: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    income_ceiling: Mapped[Decimal | None] = mapped_column(Numeric(16, 2), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
