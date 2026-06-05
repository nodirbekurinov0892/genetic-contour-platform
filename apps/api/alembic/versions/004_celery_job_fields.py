"""Add cancel_requested and celery_task_id for queue jobs

Revision ID: 004_celery_job_fields
Revises: 003_storage_keys
Create Date: 2026-06-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_celery_job_fields"
down_revision: Union[str, None] = "003_storage_keys"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "experiments",
        sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "experiments",
        sa.Column("celery_task_id", sa.String(length=255), nullable=True),
    )
    op.alter_column("experiments", "cancel_requested", server_default=None)


def downgrade() -> None:
    op.drop_column("experiments", "celery_task_id")
    op.drop_column("experiments", "cancel_requested")
