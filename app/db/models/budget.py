"""Budget model."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class Budget(IdMixin, TimestampMixin, Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "period", "category", name="uq_budget_period_category"),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    period: Mapped[date] = mapped_column(Date, index=True, nullable=False)  # first day of month
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
