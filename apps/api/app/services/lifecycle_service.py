"""Data lifecycle: image/GT delete, storage cleanup, orphan detection."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.benchmark import StorageOrphan
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.user import User
from app.services.storage import StorageService
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)


class LifecycleService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def delete_image(self, image_id: uuid.UUID, user: User) -> None:
        result = await self.db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        ensure_owner(image.user_id, user.id, "image")

        exp_count = await self.db.scalar(
            select(Experiment.id).where(Experiment.image_id == image_id).limit(1)
        )
        if exp_count:
            raise HTTPException(
                status_code=409,
                detail="Image has linked experiments. Delete experiments first.",
            )

        keys = [image.storage_key]
        if image.ground_truth_storage_key:
            keys.append(image.ground_truth_storage_key)
        for key in keys:
            try:
                self.storage.delete_file(key)
            except OSError:
                logger.warning("Failed to delete storage key %s", key, exc_info=True)

        await self.db.execute(delete(Image).where(Image.id == image_id))
        await self.db.flush()
        logger.info("Deleted image %s and storage artifacts", image_id)

    async def delete_ground_truth(self, image_id: uuid.UUID, user: User) -> Image:
        result = await self.db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        ensure_owner(image.user_id, user.id, "image")

        if not image.ground_truth_storage_key:
            raise HTTPException(status_code=404, detail="No ground truth to delete")

        try:
            self.storage.delete_file(image.ground_truth_storage_key)
        except OSError:
            logger.warning("GT storage delete failed for %s", image_id, exc_info=True)

        image.ground_truth_storage_key = None
        image.ground_truth_public_url = None
        image.ground_truth_file_path = None
        image.ground_truth_uploaded_at = None
        image.gt_checksum = None
        image.gt_validation_status = None
        image.gt_validation_metadata = None
        image.gt_provenance_json = None
        image.gt_validated_at = None
        await self.db.flush()
        return image

    async def detect_orphans(self, user: User) -> list[str]:
        """Scan storage prefixes and record keys not referenced in DB."""
        referenced: set[str] = set()
        images = await self.db.execute(select(Image).where(Image.user_id == user.id))
        for img in images.scalars().all():
            referenced.add(img.storage_key)
            if img.ground_truth_storage_key:
                referenced.add(img.ground_truth_storage_key)

        orphans: list[str] = []
        for prefix in ("uploads/", "results/"):
            try:
                keys = self.storage.list_prefix(prefix)
            except (NotImplementedError, AttributeError):
                continue
            for key in keys:
                if key not in referenced:
                    orphans.append(key)
                    existing = await self.db.execute(
                        select(StorageOrphan).where(StorageOrphan.storage_key == key)
                    )
                    if not existing.scalar_one_or_none():
                        self.db.add(
                            StorageOrphan(
                                id=uuid.uuid4(),
                                storage_key=key,
                                source="lifecycle_scan",
                            )
                        )
        await self.db.flush()
        return orphans

    async def cleanup_orphans(self, user: User, keys: list[str] | None = None) -> int:
        if keys is None:
            keys = await self.detect_orphans(user)
        removed = 0
        for key in keys:
            try:
                self.storage.delete_file(key)
                removed += 1
                row = await self.db.execute(
                    select(StorageOrphan).where(StorageOrphan.storage_key == key)
                )
                orphan = row.scalar_one_or_none()
                if orphan:
                    orphan.resolved_at = datetime.now(timezone.utc)
            except OSError:
                logger.warning("Orphan cleanup failed for %s", key, exc_info=True)
        await self.db.flush()
        return removed
