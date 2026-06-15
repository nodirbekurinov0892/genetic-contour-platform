"""Explicit storage repair actions — never auto-delete production data."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.user import User
from app.services.gt_validation import GT_STATUS_STALE
from app.services.storage import StorageService
from app.services.storage_audit_service import StorageAuditService
from app.utils.ownership import ensure_owner


class StorageRepairService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)
        self.audit = StorageAuditService(db, settings)

    async def mark_missing(self, user: User) -> dict[str, Any]:
        report = await self.audit.audit_for_user(user)
        marked: list[dict[str, str]] = []

        for record in report["broken_records"]:
            issue = record["issue"]
            image_id = record.get("image_id")
            if not image_id:
                continue

            result = await self.db.execute(select(Image).where(Image.id == uuid.UUID(image_id)))
            image = result.scalar_one_or_none()
            if not image:
                continue
            ensure_owner(image.user_id, user.id, "image")

            if issue == "missing_ground_truth":
                image.gt_validation_status = GT_STATUS_STALE
                meta = dict(image.gt_validation_metadata or {})
                meta["storage_file_missing"] = True
                meta["marked_at"] = datetime.now(timezone.utc).isoformat()
                image.gt_validation_metadata = meta
                marked.append({"image_id": image_id, "issue": issue, "action": "marked_stale"})
            elif issue == "missing_original":
                meta = dict(image.gt_validation_metadata or {})
                meta["original_storage_missing"] = True
                meta["marked_at"] = datetime.now(timezone.utc).isoformat()
                image.gt_validation_metadata = meta
                marked.append({"image_id": image_id, "issue": issue, "action": "marked_metadata"})

        await self.db.flush()
        return {
            "marked_count": len(marked),
            "marked_records": marked,
            "audit": report,
        }

    async def clear_ground_truth_reference(self, image_id: uuid.UUID, user: User) -> Image:
        result = await self.db.execute(select(Image).where(Image.id == image_id))
        image = result.scalar_one_or_none()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        ensure_owner(image.user_id, user.id, "image")

        if not image.ground_truth_storage_key:
            raise HTTPException(status_code=404, detail="No ground truth reference to clear")

        gt_key = self.storage.resolve_storage_key(
            storage_key=image.ground_truth_storage_key,
            file_path=image.ground_truth_file_path,
        )
        if self.storage.exists(gt_key):
            raise HTTPException(
                status_code=409,
                detail="Ground truth file exists in storage; use lifecycle delete instead",
            )

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

    async def delete_image_record(self, image_id: uuid.UUID, user: User) -> dict[str, str]:
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

        for key in (image.storage_key, image.ground_truth_storage_key):
            if key and self.storage.exists(key):
                self.storage.delete_file(key)

        await self.db.execute(delete(Image).where(Image.id == image_id))
        await self.db.flush()
        return {"message": "Image record deleted", "image_id": str(image_id)}
