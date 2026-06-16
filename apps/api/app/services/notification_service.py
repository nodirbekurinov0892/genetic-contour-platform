"""In-app notifications."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: str,
        title: str,
        message: str,
        payload: dict | None = None,
    ) -> Notification:
        note = Notification(
            id=uuid.uuid4(),
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            payload_json=payload,
        )
        self.db.add(note)
        await self.db.flush()
        return note

    async def list_for_user(self, user: User, *, limit: int = 50, unread_only: bool = False) -> list[Notification]:
        query = select(Notification).where(Notification.user_id == user.id)
        if unread_only:
            query = query.where(Notification.read_at.is_(None))
        result = await self.db.execute(query.order_by(Notification.created_at.desc()).limit(limit))
        return list(result.scalars().all())

    async def unread_count(self, user: User) -> int:
        count = await self.db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        )
        return int(count or 0)

    async def mark_read(self, notification_id: uuid.UUID, user: User) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user.id)
            .values(read_at=datetime.now(timezone.utc))
        )

    async def mark_all_read(self, user: User) -> None:
        await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
            .values(read_at=datetime.now(timezone.utc))
        )
