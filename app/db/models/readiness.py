"""Credit readiness score and its explainable factors."""


from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, IdMixin, TimestampMixin


class ReadinessScore(IdMixin, TimestampMixin, Base):
    __tablename__ = "readiness_scores"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    version: Mapped[str] = mapped_column(String(20), default="1.0", nullable=False)
    previous_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    change_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ReadinessFactor(IdMixin, Base):
    __tablename__ = "readiness_factors"

    readiness_score_id: Mapped[int] = mapped_column(
        ForeignKey("readiness_scores.id", ondelete="CASCADE"), index=True, nullable=False
    )
    factor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    impact: Mapped[int] = mapped_column(Integer, nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)  # positive|negative|neutral
    explanation: Mapped[str] = mapped_column(String(500), nullable=False)
    value: Mapped[str | None] = mapped_column(String(200), nullable=True)
