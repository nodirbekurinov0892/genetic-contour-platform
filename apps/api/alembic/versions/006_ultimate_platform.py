"""Phase Ultimate: GT manager, fair protocol, benchmarks, auth hardening, lifecycle."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "006_ultimate_platform"
down_revision: Union[str, None] = "005_research_grade"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- images: GT lifecycle ---
    op.add_column("images", sa.Column("dataset_version", sa.String(length=64), nullable=True))
    op.add_column("images", sa.Column("content_checksum", sa.String(length=64), nullable=True))
    op.add_column("images", sa.Column("gt_checksum", sa.String(length=64), nullable=True))
    op.add_column(
        "images",
        sa.Column("gt_validation_status", sa.String(length=32), nullable=True),
    )
    op.add_column(
        "images",
        sa.Column(
            "gt_validation_metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "images",
        sa.Column("gt_provenance_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.add_column(
        "images",
        sa.Column("gt_validated_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- experiments: reproducibility v2 + fair protocol ---
    op.add_column("experiments", sa.Column("comparison_protocol", sa.String(length=32), nullable=True))
    op.add_column("experiments", sa.Column("methodology_version", sa.String(length=32), nullable=True))
    op.add_column("experiments", sa.Column("experiment_seed", sa.Integer(), nullable=True))
    op.add_column(
        "experiments",
        sa.Column("parent_experiment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "experiments",
        sa.Column("benchmark_run_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "experiments",
        sa.Column(
            "experiment_lineage_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_experiments_parent_experiment_id",
        "experiments",
        "experiments",
        ["parent_experiment_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # --- users: auth hardening ---
    op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("email_verification_token", sa.String(length=128), nullable=True))
    op.add_column("users", sa.Column("password_reset_token", sa.String(length=128), nullable=True))
    op.add_column(
        "users",
        sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("onboarding_completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # --- benchmarks ---
    op.create_table(
        "benchmarks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=128), nullable=False, unique=True),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("methodology_version", sa.String(length=32), nullable=False, server_default="fair_v1"),
        sa.Column("comparison_protocol", sa.String(length=32), nullable=False, server_default="fair_v1"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "benchmark_datasets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "benchmark_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("benchmarks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "image_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("images.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("benchmark_id", "image_id", name="uq_benchmark_dataset_image"),
    )

    op.create_table(
        "benchmark_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "benchmark_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("benchmarks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("cohort_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "aggregate_metrics_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("report_storage_key", sa.String(length=1024), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key(
        "fk_experiments_benchmark_run_id",
        "experiments",
        "benchmark_runs",
        ["benchmark_run_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "benchmark_leaderboard",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "benchmark_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("benchmarks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "benchmark_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("benchmark_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("algorithm_name", sa.String(length=64), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("avg_iou", sa.Float(), nullable=True),
        sa.Column("avg_f1", sa.Float(), nullable=True),
        sa.Column("avg_dice", sa.Float(), nullable=True),
        sa.Column("avg_runtime_ms", sa.Float(), nullable=True),
        sa.Column("sample_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "storage_orphans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("storage_key", sa.String(length=1024), nullable=False, unique=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("storage_orphans")
    op.drop_table("benchmark_leaderboard")
    op.drop_constraint("fk_experiments_benchmark_run_id", "experiments", type_="foreignkey")
    op.drop_table("benchmark_runs")
    op.drop_table("benchmark_datasets")
    op.drop_table("benchmarks")
    op.drop_column("users", "onboarding_completed_at")
    op.drop_column("users", "password_reset_expires_at")
    op.drop_column("users", "password_reset_token")
    op.drop_column("users", "email_verification_token")
    op.drop_column("users", "email_verified")
    op.drop_constraint("fk_experiments_parent_experiment_id", "experiments", type_="foreignkey")
    op.drop_column("experiments", "experiment_lineage_json")
    op.drop_column("experiments", "benchmark_run_id")
    op.drop_column("experiments", "parent_experiment_id")
    op.drop_column("experiments", "experiment_seed")
    op.drop_column("experiments", "methodology_version")
    op.drop_column("experiments", "comparison_protocol")
    op.drop_column("images", "gt_validated_at")
    op.drop_column("images", "gt_provenance_json")
    op.drop_column("images", "gt_validation_metadata")
    op.drop_column("images", "gt_validation_status")
    op.drop_column("images", "gt_checksum")
    op.drop_column("images", "content_checksum")
    op.drop_column("images", "dataset_version")
