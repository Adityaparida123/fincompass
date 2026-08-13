"""Add missing updated_at column to audit_logs."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_audit_logs_updated_at"
down_revision: Union[str, None] = "0002_refresh_token_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("audit_logs") as batch_op:
        batch_op.drop_column("updated_at")
