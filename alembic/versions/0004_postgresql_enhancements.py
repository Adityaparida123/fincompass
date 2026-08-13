"""PostgreSQL production enhancements: ML predictions, readiness metadata, indexes.

Revision ID: 0004_postgresql_enhancements
Revises: 0003_audit_logs_updated_at
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_postgresql_enhancements"
down_revision: str | None = "0003_audit_logs_updated_at"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgresql() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    bind = op.get_bind()

    if _is_postgresql():
        op.execute(
            sa.text(
                "ALTER TYPE consent_type ADD VALUE IF NOT EXISTS 'ml_analysis'"
            )
        )

    op.add_column(
        "readiness_scores",
        sa.Column("model_version", sa.String(length=20), nullable=False, server_default="1.0"),
    )
    op.add_column(
        "readiness_scores",
        sa.Column("feature_version", sa.String(length=20), nullable=False, server_default="1.0"),
    )
    op.add_column(
        "readiness_scores",
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    json_type = postgresql.JSONB(astext_type=sa.Text()) if _is_postgresql() else sa.JSON()
    op.create_table(
        "ml_predictions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prediction_type", sa.String(length=100), nullable=False),
        sa.Column("prediction_value", json_type, nullable=False),
        sa.Column("confidence", sa.Numeric(8, 4), nullable=True),
        sa.Column("model_name", sa.String(length=100), nullable=False),
        sa.Column("model_version", sa.String(length=20), nullable=False),
        sa.Column("feature_version", sa.String(length=20), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_ml_predictions_user_id", "ml_predictions", ["user_id"])
    op.create_index("ix_ml_predictions_prediction_type", "ml_predictions", ["prediction_type"])
    op.create_index("ix_ml_predictions_created_at", "ml_predictions", ["created_at"])
    op.create_index("ix_ml_predictions_user_type", "ml_predictions", ["user_id", "prediction_type"])

    op.create_index(
        "ix_transactions_user_date",
        "transactions",
        ["user_id", "date"],
        unique=False,
    )
    op.create_index(
        "ix_notifications_user_read",
        "notifications",
        ["user_id", "is_read"],
        unique=False,
    )
    op.create_index(
        "ix_readiness_scores_user_created",
        "readiness_scores",
        ["user_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_readiness_scores_user_created", table_name="readiness_scores")
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_index("ix_transactions_user_date", table_name="transactions")
    op.drop_index("ix_ml_predictions_user_type", table_name="ml_predictions")
    op.drop_index("ix_ml_predictions_created_at", table_name="ml_predictions")
    op.drop_index("ix_ml_predictions_prediction_type", table_name="ml_predictions")
    op.drop_index("ix_ml_predictions_user_id", table_name="ml_predictions")
    op.drop_table("ml_predictions")
    op.drop_column("readiness_scores", "calculated_at")
    op.drop_column("readiness_scores", "feature_version")
    op.drop_column("readiness_scores", "model_version")
