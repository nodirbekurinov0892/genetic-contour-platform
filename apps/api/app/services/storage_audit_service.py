"""DB ↔ storage consistency audit."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.result_image import ResultImage
from app.models.user import User
from app.services.storage import StorageService


class StorageAuditService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def audit_for_user(self, user: User) -> dict[str, Any]:
        images = (
            await self.db.execute(select(Image).where(Image.user_id == user.id))
        ).scalars().all()

        missing_originals = 0
        missing_ground_truth = 0
        missing_results = 0
        broken_records: list[dict[str, Any]] = []

        for image in images:
            original_key = self.storage.resolve_storage_key(
                storage_key=image.storage_key,
                file_path=image.file_path,
            )
            original_exists = self.storage.exists(original_key)
            if not original_exists:
                missing_originals += 1
                broken_records.append(
                    {
                        "image_id": str(image.id),
                        "original_name": image.original_name,
                        "issue": "missing_original",
                        "storage_key": original_key,
                    }
                )

            gt_key_ref = image.ground_truth_storage_key
            if gt_key_ref:
                gt_key = self.storage.resolve_storage_key(
                    storage_key=gt_key_ref,
                    file_path=image.ground_truth_file_path,
                )
                gt_exists = self.storage.exists(gt_key)
                if not gt_exists:
                    missing_ground_truth += 1
                    broken_records.append(
                        {
                            "image_id": str(image.id),
                            "original_name": image.original_name,
                            "issue": "missing_ground_truth",
                            "storage_key": gt_key,
                        }
                    )

        exp_result = await self.db.execute(
            select(Experiment)
            .where(Experiment.user_id == user.id)
            .options(
                selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.result_images)
            )
        )
        for experiment in exp_result.scalars().all():
            for run in experiment.algorithm_runs:
                for result_image in run.result_images:
                    if not self.storage.exists(result_image.storage_key):
                        missing_results += 1
                        broken_records.append(
                            {
                                "experiment_id": str(experiment.id),
                                "run_id": str(run.id),
                                "result_image_id": str(result_image.id),
                                "issue": "missing_result",
                                "storage_key": result_image.storage_key,
                                "type": result_image.type,
                            }
                        )

        total_issues = missing_originals + missing_ground_truth + missing_results
        if total_issues == 0:
            severity = "none"
        elif missing_originals > 0:
            severity = "critical"
        elif missing_ground_truth > 0:
            severity = "high"
        else:
            severity = "medium"

        return {
            "total_images": len(images),
            "missing_originals": missing_originals,
            "missing_ground_truth": missing_ground_truth,
            "missing_results": missing_results,
            "broken_records": broken_records,
            "severity": severity,
            "repair_available": total_issues > 0,
            "storage_backend": self.settings.storage_backend,
        }
