"""Add storage_key and public_url columns

Revision ID: 003_storage_keys
Revises: 002_experiment_jobs
Create Date: 2026-06-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_storage_keys"
down_revision: Union[str, None] = "002_experiment_jobs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # images
    op.add_column("images", sa.Column("storage_key", sa.String(length=1024), nullable=True))
    op.add_column("images", sa.Column("public_url", sa.String(length=2048), nullable=True))
    op.alter_column("images", "file_path", existing_type=sa.String(length=1024), nullable=True)
    op.execute(
        """
        UPDATE images
        SET storage_key = file_path,
            public_url = ''
        WHERE storage_key IS NULL AND file_path IS NOT NULL
        """
    )
    op.alter_column("images", "storage_key", nullable=False)
    op.alter_column("images", "public_url", nullable=False)

    # result_images
    op.add_column("result_images", sa.Column("storage_key", sa.String(length=1024), nullable=True))
    op.add_column("result_images", sa.Column("public_url", sa.String(length=2048), nullable=True))
    op.alter_column("result_images", "file_path", existing_type=sa.String(length=1024), nullable=True)
    op.execute(
        """
        UPDATE result_images
        SET storage_key = file_path,
            public_url = ''
        WHERE storage_key IS NULL AND file_path IS NOT NULL
        """
    )
    op.alter_column("result_images", "storage_key", nullable=False)
    op.alter_column("result_images", "public_url", nullable=False)

    # reports
    op.add_column("reports", sa.Column("storage_key", sa.String(length=1024), nullable=True))
    op.add_column("reports", sa.Column("public_url", sa.String(length=2048), nullable=True))
    op.alter_column("reports", "file_path", existing_type=sa.String(length=1024), nullable=True)
    op.execute(
        """
        UPDATE reports
        SET storage_key = file_path,
            public_url = ''
        WHERE storage_key IS NULL AND file_path IS NOT NULL
        """
    )
    op.alter_column("reports", "storage_key", nullable=False)
    op.alter_column("reports", "public_url", nullable=False)


def downgrade() -> None:
    op.alter_column("reports", "file_path", existing_type=sa.String(length=1024), nullable=False)
    op.drop_column("reports", "public_url")
    op.drop_column("reports", "storage_key")

    op.alter_column("result_images", "file_path", existing_type=sa.String(length=1024), nullable=False)
    op.drop_column("result_images", "public_url")
    op.drop_column("result_images", "storage_key")

    op.alter_column("images", "file_path", existing_type=sa.String(length=1024), nullable=False)
    op.drop_column("images", "public_url")
    op.drop_column("images", "storage_key")
