"""Detect optional schema columns from migration 011 (graceful degradation)."""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_COLUMN_CACHE: dict[tuple[str, str], bool] = {}


async def table_has_column(db: AsyncSession, table: str, column: str) -> bool:
    key = (table, column)
    if key in _COLUMN_CACHE:
        return _COLUMN_CACHE[key]
    result = await db.execute(
        text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :table AND column_name = :column "
            "LIMIT 1"
        ),
        {"table": table, "column": column},
    )
    exists = result.scalar() is not None
    _COLUMN_CACHE[key] = exists
    return exists


async def migration_011_applied(db: AsyncSession) -> bool:
    """True when soft-delete columns from 011 exist on reports."""
    return await table_has_column(db, "reports", "deleted_at")
