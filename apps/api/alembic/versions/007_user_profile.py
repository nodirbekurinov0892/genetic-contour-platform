"""user profile fields

Revision ID: 007_user_profile
Revises: 006_ultimate_platform
Create Date: 2026-06-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_user_profile"
down_revision: Union[str, None] = "006_ultimate_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_data", sa.JSON(), nullable=True))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "profile_data")
