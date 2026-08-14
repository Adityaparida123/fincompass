"""Savings goal model."""

from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin
from app.db.enums import SavingsGoalStatus

__all__ = ["SavingsGoal", "SavingsGoalStatus"]


class SavingsGoal(IdMixin, TimestampMixin, Base):
    __tablename__ = "savings_goals"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), default=0, nullable=False)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[SavingsGoalStatus] = mapped_column(
        SqlEnum(SavingsGoalStatus, name="savings_goal_status"),
        default=SavingsGoalStatus.active,
        nullable=False,
    )
