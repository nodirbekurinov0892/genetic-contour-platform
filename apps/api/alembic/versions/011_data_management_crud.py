"""Data management CRUD: soft archive/delete timestamps.

Revision ID: 011_data_management
Revises: 010_enterprise_evolution
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_data_management"
down_revision: Union[str, None] = "010_enterprise_evolution"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("experiments", "images", "benchmarks", "reports"):
        op.add_column(
            table,
            sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.add_column(
            table,
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )
    op.add_column("images", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("reports", sa.Column("title", sa.String(length=512), nullable=True))
    op.create_index("ix_experiments_archived_at", "experiments", ["archived_at"])
    op.create_index("ix_experiments_deleted_at", "experiments", ["deleted_at"])
    op.create_index("ix_images_deleted_at", "images", ["deleted_at"])
    op.create_index("ix_benchmarks_deleted_at", "benchmarks", ["deleted_at"])


def downgrade() -> None:
    op.drop_index("ix_benchmarks_deleted_at", table_name="benchmarks")
    op.drop_index("ix_images_deleted_at", table_name="images")
    op.drop_index("ix_experiments_deleted_at", table_name="experiments")
    op.drop_index("ix_experiments_archived_at", table_name="experiments")
    op.drop_column("reports", "title")
    op.drop_column("images", "description")
    for table in ("reports", "benchmarks", "images", "experiments"):
        op.drop_column(table, "deleted_at")
        op.drop_column(table, "archived_at")
