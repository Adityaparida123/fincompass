"""Debt obligation model."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class DebtObligation(IdMixin, TimestampMixin, Base):
    __tablename__ = "debt_obligations"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    principal: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    monthly_payment: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=0, nullable=False)
    remaining_balance: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
