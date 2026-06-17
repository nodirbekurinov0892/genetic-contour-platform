"""Shared data management helpers: audit logging and visibility filters."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.experiment import Experiment
from app.models.user import User
from app.services.audit_service import AuditService


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def audit_action(
    db: AsyncSession,
    *,
    user: User,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID | str,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    await AuditService(db).log(
        user_id=user.id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id),
        details=details,
        ip_address=ip_address,
    )


def active_experiment_filter(include_archived: bool = False, include_deleted: bool = False):
    clauses = []
    if not include_archived:
        clauses.append(Experiment.archived_at.is_(None))
    if not include_deleted:
        clauses.append(Experiment.deleted_at.is_(None))
    return clauses


async def count_experiments_for_image(db: AsyncSession, image_id: uuid.UUID) -> int:
    result = await db.scalar(
        select(func.count())
        .select_from(Experiment)
        .where(
            Experiment.image_id == image_id,
            Experiment.deleted_at.is_(None),
        )
    )
    return int(result or 0)
