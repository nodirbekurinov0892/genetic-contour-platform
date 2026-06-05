"""Experiment job tracking fields

Revision ID: 002_experiment_jobs
Revises: 001_initial
Create Date: 2026-06-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_experiment_jobs"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("experiments", sa.Column("job_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column(
        "experiments",
        sa.Column("progress_percent", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column("experiments", sa.Column("current_generation", sa.Integer(), nullable=True))
    op.add_column("experiments", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("experiments", sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("experiments", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("experiments", "error_message")
    op.drop_column("experiments", "finished_at")
    op.drop_column("experiments", "started_at")
    op.drop_column("experiments", "current_generation")
    op.drop_column("experiments", "progress_percent")
    op.drop_column("experiments", "job_params")
