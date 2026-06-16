"""Enterprise benchmark evolution: created_by, batch_size, org projects

Revision ID: 010_enterprise_evolution
Revises: 009_production_indexes
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "010_enterprise_evolution"
down_revision: Union[str, None] = "009_production_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "benchmarks",
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "benchmark_runs",
        sa.Column("batch_size", sa.Integer(), nullable=True),
    )
    op.create_table(
        "organization_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=256), nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("organization_id", "slug", name="uq_org_project_slug"),
    )
    op.create_index("ix_organization_projects_org_id", "organization_projects", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_organization_projects_org_id", table_name="organization_projects")
    op.drop_table("organization_projects")
    op.drop_column("benchmark_runs", "batch_size")
    op.drop_column("benchmarks", "created_by")
