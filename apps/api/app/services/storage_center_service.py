"""Storage center — usage summary from DB + storage metadata."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.report import Report
from app.models.user import User
from app.services.storage import StorageService


class StorageCenterService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def get_summary(self, user: User) -> dict:
        user_id = user.id

        image_count = await self.db.scalar(
            select(func.count()).select_from(Image).where(Image.user_id == user_id)
        )
        image_bytes = await self.db.scalar(
            select(func.coalesce(func.sum(Image.size), 0)).where(Image.user_id == user_id)
        )
        gt_count = await self.db.scalar(
            select(func.count())
            .select_from(Image)
            .where(
                Image.user_id == user_id,
                Image.ground_truth_storage_key.isnot(None),
                Image.ground_truth_storage_key != "",
            )
        )
        report_count = await self.db.scalar(
            select(func.count())
            .select_from(Report)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(Experiment.user_id == user_id)
        )

        return {
            "backend": self.settings.storage_backend,
            "health": "healthy",
            "images": {
                "count": image_count or 0,
                "bytes": int(image_bytes or 0),
                "mb": round(int(image_bytes or 0) / (1024 * 1024), 2),
            },
            "ground_truths": {
                "count": gt_count or 0,
            },
            "reports": {
                "count": report_count or 0,
            },
            "exports": {
                "count": report_count or 0,
            },
            "total_storage_bytes": int(image_bytes or 0),
            "total_storage_mb": round(int(image_bytes or 0) / (1024 * 1024), 2),
            "total_bytes": int(image_bytes or 0),
            "total_mb": round(int(image_bytes or 0) / (1024 * 1024), 2),
            "orphan_files": 0,
            "cleanup_available": False,
            "audit_available": True,
            "repair_available": True,
        }
