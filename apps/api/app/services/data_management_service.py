"""Data management CRUD: images, reports, benchmarks, bulk actions, storage cleanup."""

from __future__ import annotations

import io
import logging
import uuid
import zipfile
from datetime import datetime, timezone

import cv2
import numpy as np
from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkDataset, BenchmarkRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.report import Report
from app.models.user import User
from app.services.data_management_helpers import audit_action, count_experiments_for_image, utcnow
from app.services.experiment_service import ExperimentService
from app.services.gt_validation import sha256_hex
from app.services.lifecycle_service import LifecycleService
from app.services.report_service import ReportService
from app.services.storage import StorageService
from app.utils.file_utils import detect_mime_type, validate_extension
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)


class ImageManagementService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def get_usage(self, image_id: uuid.UUID, user: User) -> dict:
        from app.services.image_service import ImageService

        await ImageService(self.db, self.settings).get_by_id(image_id, user)
        count = await count_experiments_for_image(self.db, image_id)
        exp_ids = await self.db.execute(
            select(Experiment.id, Experiment.title)
            .where(Experiment.image_id == image_id, Experiment.deleted_at.is_(None))
            .limit(20)
        )
        experiments = [{"id": str(r[0]), "title": r[1]} for r in exp_ids.all()]
        return {"experiment_count": count, "experiments": experiments}

    async def update_metadata(
        self,
        image_id: uuid.UUID,
        user: User,
        *,
        original_name: str | None = None,
        description: str | None = None,
    ) -> Image:
        from app.services.image_service import ImageService

        image = await ImageService(self.db, self.settings).get_by_id(image_id, user)
        if image.deleted_at:
            raise HTTPException(status_code=404, detail="Image not found")
        if original_name is not None:
            name = original_name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="Name cannot be empty")
            image.original_name = name
        if description is not None:
            image.description = description.strip() or None
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="image.update",
            resource_type="image",
            resource_id=image_id,
            details={"original_name": image.original_name},
        )
        return image

    async def replace_file(self, image_id: uuid.UUID, file: UploadFile, user: User) -> Image:
        from app.services.image_service import ImageService

        image = await ImageService(self.db, self.settings).get_by_id(image_id, user)
        if not file.filename or not validate_extension(file.filename):
            raise HTTPException(status_code=400, detail="Invalid file extension")
        content = await file.read()
        if len(content) > self.settings.max_upload_bytes:
            raise HTTPException(status_code=413, detail="File too large")
        mime = detect_mime_type(content, file.filename or "")
        if mime not in self.settings.allowed_mime_list:
            raise HTTPException(status_code=400, detail=f"Invalid MIME type: {mime}")

        arr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
        if arr is None:
            raise HTTPException(status_code=400, detail="Unable to decode image")

        old_key = image.storage_key
        ext = "." + (file.filename.rsplit(".", 1)[-1].lower() if file.filename else "png")
        new_key = self.storage.upload_key(ext)
        stored = self.storage.save_bytes(new_key, content, mime)
        height, width = arr.shape[:2]

        image.storage_key = stored.storage_key
        image.public_url = stored.public_url
        image.file_path = stored.storage_key
        image.width = width
        image.height = height
        image.size = len(content)
        image.mime_type = mime
        image.content_checksum = sha256_hex(content)
        await self.db.flush()

        if old_key and old_key != stored.storage_key:
            try:
                self.storage.delete_file(old_key)
            except OSError:
                logger.warning("Failed to delete replaced image key %s", old_key)

        await audit_action(
            self.db,
            user=user,
            action="image.replace",
            resource_type="image",
            resource_id=image_id,
        )
        return image

    async def cleanup_broken(self, image_id: uuid.UUID, user: User) -> dict:
        from app.services.storage_repair_service import StorageRepairService

        result = await StorageRepairService(self.db, self.settings).delete_image_record(
            image_id, user
        )
        await audit_action(
            self.db,
            user=user,
            action="image.cleanup_broken",
            resource_type="image",
            resource_id=image_id,
        )
        return result

    async def delete_image(
        self,
        image_id: uuid.UUID,
        user: User,
        *,
        cascade_experiments: bool = False,
        archive: bool = False,
        permanent: bool = False,
    ) -> dict:
        from app.services.image_service import ImageService

        image = await ImageService(self.db, self.settings).get_by_id(image_id, user)
        exp_count = await count_experiments_for_image(self.db, image_id)

        if exp_count and not archive and not cascade_experiments:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Bu rasm {exp_count} ta tajribada ishlatilgan. "
                    "cascade_experiments=true yoki archive=true bilan tasdiqlang."
                ),
            )

        if archive:
            image.archived_at = utcnow()
            image.deleted_at = utcnow()
            await self.db.flush()
            await audit_action(
                self.db,
                user=user,
                action="image.soft_delete",
                resource_type="image",
                resource_id=image_id,
            )
            return {"message": "Image archived", "mode": "soft"}

        if cascade_experiments and exp_count:
            exp_service = ExperimentService(self.db, self.settings)
            exp_ids = (
                await self.db.execute(
                    select(Experiment.id).where(
                        Experiment.image_id == image_id,
                        Experiment.user_id == user.id,
                    )
                )
            ).scalars().all()
            for eid in exp_ids:
                await self._hard_delete_experiment_for_image_cascade(eid, user, exp_service)

        if not permanent and not cascade_experiments:
            image.archived_at = utcnow()
            image.deleted_at = utcnow()
            await self.db.flush()
            await audit_action(
                self.db,
                user=user,
                action="image.soft_delete",
                resource_type="image",
                resource_id=image_id,
            )
            return {"message": "Image archived", "mode": "soft"}

        await self._purge_image(image)
        await audit_action(
            self.db,
            user=user,
            action="image.hard_delete",
            resource_type="image",
            resource_id=image_id,
            details={"cascade_experiments": cascade_experiments},
        )
        return {"message": "Image deleted", "mode": "hard"}

    async def _hard_delete_experiment_for_image_cascade(
        self,
        experiment_id: uuid.UUID,
        user: User,
        exp_service: ExperimentService,
    ) -> None:
        try:
            await exp_service.hard_delete(experiment_id, user)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
        remaining = await self.db.scalar(
            select(Experiment.id).where(Experiment.id == experiment_id)
        )
        if remaining:
            from app.services.research_cleanup_service import ResearchCleanupService

            await ResearchCleanupService(self.db, self.settings)._hard_delete_experiment_unconditional(
                experiment_id, user, []
            )

    async def _purge_image(self, image: Image) -> None:
        keys = [image.storage_key]
        if image.ground_truth_storage_key:
            keys.append(image.ground_truth_storage_key)
        for key in keys:
            if not key:
                continue
            try:
                self.storage.delete_file(key)
            except OSError:
                logger.warning("Failed to delete storage key %s", key, exc_info=True)
        await self.db.delete(image)
        await self.db.flush()

    async def detach_gt(self, image_id: uuid.UUID, user: User) -> Image:
        lifecycle = LifecycleService(self.db, self.settings)
        try:
            image = await lifecycle.delete_ground_truth(image_id, user)
        except HTTPException as exc:
            if exc.status_code == 404:
                from app.services.storage_repair_service import StorageRepairService

                image = await StorageRepairService(self.db, self.settings).clear_ground_truth_reference(
                    image_id, user
                )
            else:
                raise
        await audit_action(
            self.db,
            user=user,
            action="image.gt_detach",
            resource_type="image",
            resource_id=image_id,
        )
        return image


class ReportManagementService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def list_reports(self, user: User, *, limit: int = 50) -> list[dict]:
        from app.utils.schema_compat import migration_011_applied

        has_soft_delete = await migration_011_applied(self.db)
        query = (
            select(Report, Experiment.title)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(Experiment.user_id == user.id)
        )
        if has_soft_delete:
            query = query.where(
                Report.deleted_at.is_(None),
                Experiment.deleted_at.is_(None),
            )
        query = query.order_by(Report.created_at.desc()).limit(limit)

        try:
            result = await self.db.execute(query)
        except Exception as exc:
            logger.warning("list_reports query failed (schema mismatch?): %s", exc)
            return []

        rows = []
        for report, exp_title in result.all():
            try:
                key = self.storage.resolve_storage_key(report.storage_key, report.file_path)
                exists = self.storage.exists(key)
            except Exception:
                logger.warning("Storage exists check failed for report %s", report.id, exc_info=True)
                exists = False
            title = getattr(report, "title", None) or f"{exp_title} ({report.format})"
            rows.append({
                "id": str(report.id),
                "experiment_id": str(report.experiment_id),
                "experiment_title": exp_title,
                "format": report.format,
                "title": title,
                "storage_status": "available" if exists else "missing",
                "created_at": report.created_at.isoformat() if report.created_at else None,
            })
        return rows

    async def update_title(self, report_id: uuid.UUID, user: User, title: str) -> Report:
        report = await self._get_report(report_id, user)
        report.title = title.strip() or None
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="report.rename",
            resource_type="report",
            resource_id=report_id,
        )
        return report

    async def delete_report(self, report_id: uuid.UUID, user: User) -> None:
        from app.utils.schema_compat import migration_011_applied

        report = await self._get_report(report_id, user)
        try:
            self.storage.delete_file(
                self.storage.resolve_storage_key(report.storage_key, report.file_path)
            )
        except OSError:
            logger.warning("Report storage delete failed for %s", report_id)
        if await migration_011_applied(self.db):
            report.deleted_at = utcnow()
        else:
            await self.db.delete(report)
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="report.delete",
            resource_type="report",
            resource_id=report_id,
        )

    async def regenerate(self, report_id: uuid.UUID, user: User) -> Report:
        report = await self._get_report(report_id, user)
        if report.format != "pdf":
            raise HTTPException(status_code=400, detail="Only PDF reports can be regenerated")
        service = ReportService(self.db, self.settings)
        pdf_bytes = await service.generate_pdf(report.experiment_id, user)
        key = self.storage.report_key(str(report.experiment_id))
        stored = self.storage.save_bytes(key, pdf_bytes, "application/pdf")
        old_key = report.storage_key
        report.storage_key = stored.storage_key
        report.public_url = stored.public_url
        report.file_path = stored.storage_key
        report.deleted_at = None
        await self.db.flush()
        if old_key and old_key != stored.storage_key:
            try:
                self.storage.delete_file(old_key)
            except OSError:
                pass
        await audit_action(
            self.db,
            user=user,
            action="report.regenerate",
            resource_type="report",
            resource_id=report_id,
        )
        return report

    async def export_zip(self, user: User, report_ids: list[uuid.UUID] | None = None) -> bytes:
        query = (
            select(Report)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(
                Experiment.user_id == user.id,
                Report.deleted_at.is_(None),
                Experiment.deleted_at.is_(None),
            )
        )
        if report_ids:
            query = query.where(Report.id.in_(report_ids))
        reports = list((await self.db.execute(query)).scalars().all())
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for report in reports:
                key = self.storage.resolve_storage_key(report.storage_key, report.file_path)
                if not self.storage.exists(key):
                    continue
                data = self.storage.get_bytes(key)
                name = f"{report.experiment_id}-{report.format}.{report.format}"
                zf.writestr(name, data)
        return buffer.getvalue()

    async def _get_report(self, report_id: uuid.UUID, user: User) -> Report:
        from app.utils.schema_compat import migration_011_applied

        result = await self.db.execute(
            select(Report)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(Report.id == report_id, Experiment.user_id == user.id)
        )
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        if await migration_011_applied(self.db) and report.deleted_at:
            raise HTTPException(status_code=404, detail="Report not found")
        return report


class BenchmarkManagementService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.storage = StorageService(settings)

    async def _owned_benchmark(self, benchmark_id: uuid.UUID, user: User) -> Benchmark:
        from app.services.benchmark_service import BenchmarkService

        benchmark = await BenchmarkService(self.db, self.settings).get_benchmark(benchmark_id)
        if benchmark.created_by and benchmark.created_by != user.id:
            raise HTTPException(status_code=403, detail="Not allowed to manage this benchmark")
        if benchmark.deleted_at:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        return benchmark

    async def update_benchmark(
        self,
        benchmark_id: uuid.UUID,
        user: User,
        *,
        name: str | None = None,
        description: str | None = None,
        category: str | None = None,
    ) -> Benchmark:
        benchmark = await self._owned_benchmark(benchmark_id, user)
        if name is not None:
            benchmark.name = name.strip()
        if description is not None:
            benchmark.description = description.strip() or None
        if category is not None:
            benchmark.category = category.strip() or None
        benchmark.updated_at = utcnow()
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="benchmark.update",
            resource_type="benchmark",
            resource_id=benchmark_id,
        )
        return benchmark

    async def remove_dataset_image(
        self, benchmark_id: uuid.UUID, image_id: uuid.UUID, user: User
    ) -> None:
        benchmark = await self._owned_benchmark(benchmark_id, user)
        run_active = await self.db.scalar(
            select(func.count())
            .select_from(BenchmarkRun)
            .where(
                BenchmarkRun.benchmark_id == benchmark_id,
                BenchmarkRun.user_id == user.id,
                BenchmarkRun.status == "running",
            )
        )
        if run_active:
            raise HTTPException(status_code=409, detail="Cannot modify dataset while run is active")
        await self.db.execute(
            delete(BenchmarkDataset).where(
                BenchmarkDataset.benchmark_id == benchmark_id,
                BenchmarkDataset.image_id == image_id,
            )
        )
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="benchmark.dataset_remove",
            resource_type="benchmark",
            resource_id=benchmark_id,
            details={"image_id": str(image_id)},
        )

    async def archive_benchmark(self, benchmark_id: uuid.UUID, user: User) -> Benchmark:
        benchmark = await self._owned_benchmark(benchmark_id, user)
        benchmark.archived_at = utcnow()
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="benchmark.archive",
            resource_type="benchmark",
            resource_id=benchmark_id,
        )
        return benchmark

    async def restore_benchmark(self, benchmark_id: uuid.UUID, user: User) -> Benchmark:
        from app.services.benchmark_service import BenchmarkService

        benchmark = await BenchmarkService(self.db, self.settings).get_benchmark(benchmark_id)
        if benchmark.created_by and benchmark.created_by != user.id:
            raise HTTPException(status_code=403, detail="Not allowed")
        benchmark.archived_at = None
        benchmark.deleted_at = None
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="benchmark.restore",
            resource_type="benchmark",
            resource_id=benchmark_id,
        )
        return benchmark

    async def delete_benchmark(
        self, benchmark_id: uuid.UUID, user: User, *, permanent: bool = False
    ) -> dict:
        benchmark = await self._owned_benchmark(benchmark_id, user)
        run_count = await self.db.scalar(
            select(func.count())
            .select_from(BenchmarkRun)
            .where(
                BenchmarkRun.benchmark_id == benchmark_id,
                BenchmarkRun.status == "completed",
            )
        )
        if run_count and not permanent:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Benchmarkda {run_count} ta completed run mavjud. "
                    "permanent=true bilan tasdiqlang."
                ),
            )

        if not permanent:
            benchmark.deleted_at = utcnow()
            benchmark.archived_at = utcnow()
            await self.db.flush()
            await audit_action(
                self.db,
                user=user,
                action="benchmark.soft_delete",
                resource_type="benchmark",
                resource_id=benchmark_id,
            )
            return {"message": "Benchmark archived", "mode": "soft"}

        await self.db.delete(benchmark)
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="benchmark.hard_delete",
            resource_type="benchmark",
            resource_id=benchmark_id,
        )
        return {"message": "Benchmark deleted", "mode": "hard"}

    async def delete_impact(self, benchmark_id: uuid.UUID, user: User) -> dict:
        benchmark = await self._owned_benchmark(benchmark_id, user)
        runs = await self.db.scalar(
            select(func.count()).select_from(BenchmarkRun).where(BenchmarkRun.benchmark_id == benchmark_id)
        )
        exps = await self.db.scalar(
            select(func.count())
            .select_from(Experiment)
            .join(BenchmarkRun, Experiment.benchmark_run_id == BenchmarkRun.id)
            .where(BenchmarkRun.benchmark_id == benchmark_id)
        )
        return {
            "benchmark_id": str(benchmark_id),
            "benchmark_name": benchmark.name,
            "run_count": runs or 0,
            "linked_experiments": exps or 0,
            "dataset_count": len(benchmark.datasets),
        }


class StorageCleanupService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def health_dashboard(self, user: User) -> dict:
        from app.services.storage_audit_service import StorageAuditService
        from app.services.storage_center_service import StorageCenterService
        from app.services.lifecycle_service import LifecycleService

        summary = await StorageCenterService(self.db, self.settings).get_summary(user)
        audit = await StorageAuditService(self.db, self.settings).audit_for_user(user)
        orphans = await LifecycleService(self.db, self.settings).detect_orphans(user)
        missing_originals = int(audit["missing_originals"])
        missing_ground_truth = int(audit["missing_ground_truth"])
        missing_results = int(audit["missing_results"])
        broken_records = audit["broken_records"]
        missing = missing_originals + missing_ground_truth + missing_results
        ghost = len(broken_records)
        orphan_count = len(orphans)
        score = max(0, 100 - missing * 5 - ghost * 3 - orphan_count)
        return {
            **summary,
            "missing_originals": missing_originals,
            "missing_ground_truth": missing_ground_truth,
            "missing_results": missing_results,
            "missing_files": missing,
            "ghost_records": ghost,
            "broken_records": ghost,
            "orphan_files": orphan_count,
            "health_score": score,
            "cleanup_available": missing + ghost + orphan_count > 0,
            "audit_severity": audit["severity"],
        }

    async def cleanup_broken_reports(self, user: User) -> dict:
        from app.utils.schema_compat import migration_011_applied

        has_soft = await migration_011_applied(self.db)
        query = (
            select(Report)
            .join(Experiment, Report.experiment_id == Experiment.id)
            .where(Experiment.user_id == user.id)
        )
        if has_soft:
            query = query.where(Report.deleted_at.is_(None))
        reports = list((await self.db.execute(query)).scalars().all())
        removed = 0
        for report in reports:
            key = self.storage.resolve_storage_key(report.storage_key, report.file_path)
            try:
                exists = self.storage.exists(key)
            except Exception:
                exists = False
            if exists:
                continue
            if has_soft:
                report.deleted_at = utcnow()
            else:
                await self.db.delete(report)
            removed += 1
        await self.db.flush()
        await audit_action(
            self.db,
            user=user,
            action="storage.cleanup_broken_reports",
            resource_type="storage",
            resource_id=user.id,
            details={"removed": removed},
        )
        return {"removed": removed}

    async def cleanup_broken_records(self, user: User) -> dict:
        from app.services.storage_repair_service import StorageRepairService

        marked = await StorageRepairService(self.db, self.settings).mark_missing(user)
        await audit_action(
            self.db,
            user=user,
            action="storage.cleanup_broken",
            resource_type="storage",
            resource_id=user.id,
            details=marked if isinstance(marked, dict) else {"marked": marked},
        )
        return marked if isinstance(marked, dict) else {"marked": marked}

    async def cleanup_orphans(self, user: User, keys: list[str] | None = None) -> dict:
        lifecycle = LifecycleService(self.db, self.settings)
        removed = await lifecycle.cleanup_orphans(user, keys)
        await audit_action(
            self.db,
            user=user,
            action="storage.cleanup_orphans",
            resource_type="storage",
            resource_id=user.id,
            details={"removed": removed},
        )
        return {"removed": removed}
