"""Clean Start: wipe all research data for the current user only."""

from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkLeaderboard, BenchmarkRun
from app.models.experiment import ACTIVE_STATUSES, Experiment
from app.models.image import Image
from app.models.notification import Notification
from app.models.report import Report
from app.models.user import User
from app.services.data_management_helpers import audit_action
from app.services.experiment_service import ExperimentService
from app.services.lifecycle_service import LifecycleService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

CONFIRM_PHRASE = "DELETE MY RESEARCH DATA"


class ResearchCleanupService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def cleanup_my_research_data(self, user: User, *, confirm_phrase: str) -> dict:
        if confirm_phrase.strip() != CONFIRM_PHRASE:
            raise HTTPException(
                status_code=400,
                detail=f"Confirmation phrase must be exactly: {CONFIRM_PHRASE}",
            )

        counts = {
            "experiments": 0,
            "images": 0,
            "benchmarks": 0,
            "benchmark_runs": 0,
            "reports": 0,
            "notifications": 0,
        }
        storage_failures: list[str] = []

        exp_service = ExperimentService(self.db, self.settings)

        # Cancel active experiments first.
        active = await self.db.execute(
            select(Experiment).where(
                Experiment.user_id == user.id,
                Experiment.status.in_(tuple(ACTIVE_STATUSES)),
            )
        )
        for experiment in active.scalars().all():
            try:
                await exp_service.cancel(experiment.id, user)
            except HTTPException:
                experiment.cancel_requested = True

        # Hard-delete all experiments (including archived/soft-deleted).
        exp_ids = list(
            (
                await self.db.execute(
                    select(Experiment.id).where(Experiment.user_id == user.id)
                )
            ).scalars().all()
        )
        for exp_id in exp_ids:
            await self._hard_delete_experiment_unconditional(exp_id, user, storage_failures)
            counts["experiments"] += 1

        # Benchmark runs owned by user.
        runs = list(
            (
                await self.db.execute(
                    select(BenchmarkRun)
                    .where(BenchmarkRun.user_id == user.id)
                    .options(selectinload(BenchmarkRun.leaderboard))
                )
            ).scalars().all()
        )
        for run in runs:
            if run.report_storage_key:
                self._safe_delete_storage(run.report_storage_key, storage_failures)
            await self.db.execute(
                delete(BenchmarkLeaderboard).where(
                    BenchmarkLeaderboard.benchmark_run_id == run.id
                )
            )
            await self.db.delete(run)
            counts["benchmark_runs"] += 1
        await self.db.flush()

        # Benchmarks created by user.
        benchmarks = list(
            (
                await self.db.execute(
                    select(Benchmark).where(Benchmark.created_by == user.id)
                )
            ).scalars().all()
        )
        for benchmark in benchmarks:
            await self.db.delete(benchmark)
            counts["benchmarks"] += 1
        await self.db.flush()

        # Orphan reports for user.
        reports = list(
            (
                await self.db.execute(select(Report).where(Report.user_id == user.id))
            ).scalars().all()
        )
        for report in reports:
            key = self.storage.resolve_storage_key(report.storage_key, report.file_path)
            self._safe_delete_storage(key, storage_failures)
            await self.db.delete(report)
            counts["reports"] += 1
        await self.db.flush()

        # Images owned by user.
        images = list(
            (
                await self.db.execute(select(Image).where(Image.user_id == user.id))
            ).scalars().all()
        )
        for image in images:
            keys = [image.storage_key]
            if image.ground_truth_storage_key:
                keys.append(image.ground_truth_storage_key)
            for key in keys:
                self._safe_delete_storage(key, storage_failures)
            await self.db.delete(image)
            counts["images"] += 1
        await self.db.flush()

        # All user notifications (research reset).
        notif_result = await self.db.execute(
            delete(Notification).where(Notification.user_id == user.id)
        )
        counts["notifications"] = int(notif_result.rowcount or 0)

        # Orphan storage sweep for this user prefixes.
        lifecycle = LifecycleService(self.db, self.settings)
        try:
            orphans_removed = await lifecycle.cleanup_orphans(user)
        except Exception:
            logger.exception("Orphan cleanup after research reset failed for user %s", user.id)
            orphans_removed = 0

        await audit_action(
            self.db,
            user=user,
            action="account.cleanup_research_data",
            resource_type="account",
            resource_id=user.id,
            details={**counts, "storage_failures": len(storage_failures)},
        )

        return {
            "message": "Research data cleaned",
            "deleted": counts,
            "storage_failures": storage_failures,
            "orphans_removed": orphans_removed,
        }

    async def _hard_delete_experiment_unconditional(
        self,
        experiment_id: uuid.UUID,
        user: User,
        storage_failures: list[str],
    ) -> None:
        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.id == experiment_id, Experiment.user_id == user.id)
            .options(
                selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.result_images)
            )
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            return

        if experiment.status in ACTIVE_STATUSES:
            experiment.cancel_requested = True

        for ar in experiment.algorithm_runs:
            for ri in ar.result_images:
                self._safe_delete_storage(ri.storage_key, storage_failures)

        report_rows = await self.db.execute(
            select(Report).where(Report.experiment_id == experiment_id)
        )
        for report in report_rows.scalars().all():
            key = self.storage.resolve_storage_key(report.storage_key, report.file_path)
            self._safe_delete_storage(key, storage_failures)

        await self.db.delete(experiment)
        await self.db.flush()

        try:
            self.storage.delete_prefix(f"results/{experiment_id}")
        except OSError as exc:
            storage_failures.append(f"results/{experiment_id}: {exc}")

    def _safe_delete_storage(self, key: str | None, failures: list[str]) -> None:
        if not key:
            return
        try:
            self.storage.delete_file(key)
        except OSError as exc:
            logger.warning("Storage delete failed for %s: %s", key, exc)
            failures.append(f"{key}: {exc}")
