"""Research-grade: ground truth, supervised metrics, reproducibility."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "005_research_grade"
down_revision: Union[str, None] = "004_celery_job_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "images",
        sa.Column("ground_truth_storage_key", sa.String(length=1024), nullable=True),
    )
    op.add_column(
        "images",
        sa.Column("ground_truth_public_url", sa.String(length=2048), nullable=True),
    )
    op.add_column(
        "images",
        sa.Column("ground_truth_file_path", sa.String(length=1024), nullable=True),
    )
    op.add_column(
        "images",
        sa.Column(
            "ground_truth_uploaded_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column("metrics", sa.Column("precision", sa.Float(), nullable=True))
    op.add_column("metrics", sa.Column("recall", sa.Float(), nullable=True))
    op.add_column("metrics", sa.Column("f1_score", sa.Float(), nullable=True))
    op.add_column("metrics", sa.Column("iou", sa.Float(), nullable=True))
    op.add_column("metrics", sa.Column("dice_coefficient", sa.Float(), nullable=True))

    op.add_column(
        "experiments",
        sa.Column(
            "reproducibility_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("experiments", "reproducibility_json")
    op.drop_column("metrics", "dice_coefficient")
    op.drop_column("metrics", "iou")
    op.drop_column("metrics", "f1_score")
    op.drop_column("metrics", "recall")
    op.drop_column("metrics", "precision")
    op.drop_column("images", "ground_truth_uploaded_at")
    op.drop_column("images", "ground_truth_file_path")
    op.drop_column("images", "ground_truth_public_url")
    op.drop_column("images", "ground_truth_storage_key")
