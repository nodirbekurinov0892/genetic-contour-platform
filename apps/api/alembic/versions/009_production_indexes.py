"""Production performance indexes on hot query paths

Revision ID: 009_production_indexes
Revises: 008_platform_pro
"""

from typing import Sequence, Union

from alembic import op

revision: str = "009_production_indexes"
down_revision: Union[str, None] = "008_platform_pro"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_experiments_user_id", "experiments", ["user_id"])
    op.create_index("ix_experiments_benchmark_run_id", "experiments", ["benchmark_run_id"])
    op.create_index("ix_experiments_image_id", "experiments", ["image_id"])
    op.create_index("ix_experiments_status", "experiments", ["status"])
    op.create_index("ix_algorithm_runs_experiment_id", "algorithm_runs", ["experiment_id"])
    op.create_index("ix_metrics_algorithm_run_id", "metrics", ["algorithm_run_id"])
    op.create_index("ix_benchmark_runs_benchmark_id", "benchmark_runs", ["benchmark_id"])
    op.create_index("ix_benchmark_runs_user_id", "benchmark_runs", ["user_id"])
    op.create_index(
        "ix_benchmark_leaderboard_run_id",
        "benchmark_leaderboard",
        ["benchmark_run_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_benchmark_leaderboard_run_id", table_name="benchmark_leaderboard")
    op.drop_index("ix_benchmark_runs_user_id", table_name="benchmark_runs")
    op.drop_index("ix_benchmark_runs_benchmark_id", table_name="benchmark_runs")
    op.drop_index("ix_metrics_algorithm_run_id", table_name="metrics")
    op.drop_index("ix_algorithm_runs_experiment_id", table_name="algorithm_runs")
    op.drop_index("ix_experiments_status", table_name="experiments")
    op.drop_index("ix_experiments_image_id", table_name="experiments")
    op.drop_index("ix_experiments_benchmark_run_id", table_name="experiments")
    op.drop_index("ix_experiments_user_id", table_name="experiments")
