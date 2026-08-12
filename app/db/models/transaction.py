"""Financial transaction model with soft-delete support."""

from datetime import date
from decimal import Decimal
from enum import Enum

from sqlalchemy import Date, Enum as SqlEnum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


class TransactionSource(str, Enum):
    manual = "manual"
    bank = "bank"
    upi = "upi"
    card = "card"
    import_ = "import"


class Transaction(IdMixin, TimestampMixin, Base):
    __tablename__ = "transactions"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(16, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        SqlEnum(TransactionType, name="transaction_type"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    subcategory: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[TransactionSource] = mapped_column(
        SqlEnum(TransactionSource, name="transaction_source"),
        default=TransactionSource.manual,
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(default=False, index=True, nullable=False)
