import asyncio
import logging
import uuid
from datetime import date, datetime, time, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import ACTIVE_STATUSES, Experiment, ExperimentStatus
from app.models.image import Image
from app.models.user import User
from app.schemas.experiment import ExperimentBrowseItem, ExperimentCreate, ExperimentRunRequest
from app.jobs.queue import enqueue_experiment_run, revoke_experiment_task
from app.services.storage import StorageService
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)

ALGORITHMS = {"sobel", "prewitt", "canny", "genetic", "compare_all"}


class ExperimentService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def create(self, data: ExperimentCreate, user: User) -> Experiment:
        from app.services.image_service import ImageService

        image_service = ImageService(self.db, self.settings)
        await image_service.get_by_id(data.image_id, user)

        experiment = Experiment(
            id=uuid.uuid4(),
            image_id=data.image_id,
            user_id=user.id,
            title=data.title,
            description=data.description,
            status=ExperimentStatus.PENDING.value,
        )
        self.db.add(experiment)
        await self.db.flush()
        return experiment

    async def get_by_id(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.id == experiment_id)
            .options(
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.result_images
                ),
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.metrics
                ),
                selectinload(Experiment.algorithm_runs).selectinload(
                    AlgorithmRun.generation_history
                ),
            )
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        ensure_owner(experiment.user_id, user.id, "experiment")
        if experiment.deleted_at:
            raise HTTPException(status_code=404, detail="Experiment not found")
        return experiment

    async def list_all(self, user: User, limit: int = 50, offset: int = 0) -> list[Experiment]:
        result = await self.db.execute(
            select(Experiment)
            .where(
                Experiment.user_id == user.id,
                Experiment.deleted_at.is_(None),
                Experiment.archived_at.is_(None),
            )
            .order_by(Experiment.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def update(
        self,
        experiment_id: uuid.UUID,
        user: User,
        *,
        title: str | None = None,
        description: str | None = None,
    ) -> Experiment:
        experiment = await self.get_by_id(experiment_id, user)
        if experiment.deleted_at:
            raise HTTPException(status_code=404, detail="Experiment not found")
        if title is not None:
            t = title.strip()
            if not t:
                raise HTTPException(status_code=400, detail="Title cannot be empty")
            experiment.title = t
        if description is not None:
            experiment.description = description.strip() or None
        await self.db.flush()
        from app.services.data_management_helpers import audit_action

        await audit_action(
            self.db,
            user=user,
            action="experiment.update",
            resource_type="experiment",
            resource_id=experiment_id,
        )
        return experiment

    async def archive(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        experiment = await self.get_by_id(experiment_id, user)
        if experiment.status in ACTIVE_STATUSES:
            raise HTTPException(status_code=409, detail="Running experiment cannot be archived")
        experiment.archived_at = datetime.now(timezone.utc)
        await self.db.flush()
        from app.services.data_management_helpers import audit_action

        await audit_action(
            self.db,
            user=user,
            action="experiment.archive",
            resource_type="experiment",
            resource_id=experiment_id,
        )
        return experiment

    async def restore(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        result = await self.db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        ensure_owner(experiment.user_id, user.id, "experiment")
        experiment.archived_at = None
        experiment.deleted_at = None
        await self.db.flush()
        from app.services.data_management_helpers import audit_action

        await audit_action(
            self.db,
            user=user,
            action="experiment.restore",
            resource_type="experiment",
            resource_id=experiment_id,
        )
        return experiment

    async def hard_delete(self, experiment_id: uuid.UUID, user: User) -> None:
        experiment = await self.get_by_id(experiment_id, user)
        if experiment.status in ACTIVE_STATUSES:
            try:
                await self.cancel(experiment_id, user)
            except HTTPException:
                experiment.cancel_requested = True
                if experiment.celery_task_id:
                    revoke_experiment_task(experiment.celery_task_id)
        elif experiment.celery_task_id:
            revoke_experiment_task(experiment.celery_task_id)

        storage = StorageService(self.settings)
        loaded = await self.db.execute(
            select(Experiment)
            .where(Experiment.id == experiment_id)
            .options(
                selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.result_images)
            )
        )
        exp = loaded.scalar_one()
        for ar in exp.algorithm_runs:
            for ri in ar.result_images:
                try:
                    storage.delete_file(ri.storage_key)
                except OSError:
                    logger.warning("Failed to delete result image %s", ri.storage_key)

        from app.models.report import Report

        reports = await self.db.execute(
            select(Report).where(Report.experiment_id == experiment_id)
        )
        for report in reports.scalars().all():
            try:
                storage.delete_file(report.storage_key)
            except OSError:
                pass

        self.db.delete(experiment)
        await self.db.flush()
        await asyncio.to_thread(storage.delete_prefix, f"results/{experiment.id}")
        from app.services.data_management_helpers import audit_action

        await audit_action(
            self.db,
            user=user,
            action="experiment.hard_delete",
            resource_type="experiment",
            resource_id=experiment_id,
        )

    async def soft_delete(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        experiment = await self.get_by_id(experiment_id, user)
        if experiment.status in ACTIVE_STATUSES:
            raise HTTPException(status_code=409, detail="Running experiment cannot be deleted")
        experiment.deleted_at = datetime.now(timezone.utc)
        experiment.archived_at = datetime.now(timezone.utc)
        await self.db.flush()
        from app.services.data_management_helpers import audit_action

        await audit_action(
            self.db,
            user=user,
            action="experiment.soft_delete",
            resource_type="experiment",
            resource_id=experiment_id,
        )
        return experiment

    @staticmethod
    def _duration_ms(experiment: Experiment) -> int | None:
        if experiment.started_at and experiment.finished_at:
            delta = experiment.finished_at - experiment.started_at
            return int(delta.total_seconds() * 1000)
        return None

    @staticmethod
    def _algorithm_from_job(job_params: dict | None) -> str | None:
        if not job_params:
            return None
        return job_params.get("algorithm")

    async def browse(
        self,
        user: User,
        *,
        search: str | None = None,
        status: str | None = None,
        algorithm: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        sort: str = "created_at_desc",
        limit: int = 20,
        offset: int = 0,
        include_archived: bool = False,
    ) -> tuple[list[ExperimentBrowseItem], int]:
        query = (
            select(Experiment, Image.original_name)
            .join(Image, Experiment.image_id == Image.id)
            .where(Experiment.user_id == user.id, Experiment.deleted_at.is_(None))
        )
        count_query = select(func.count()).select_from(Experiment).where(
            Experiment.user_id == user.id,
            Experiment.deleted_at.is_(None),
        )
        if not include_archived:
            query = query.where(Experiment.archived_at.is_(None))
            count_query = count_query.where(Experiment.archived_at.is_(None))

        if search and search.strip():
            pattern = f"%{search.strip()}%"
            query = query.where(Experiment.title.ilike(pattern))
            count_query = count_query.where(Experiment.title.ilike(pattern))
        if status:
            query = query.where(Experiment.status == status)
            count_query = count_query.where(Experiment.status == status)
        if algorithm:
            query = query.where(Experiment.job_params["algorithm"].astext == algorithm)
            count_query = count_query.where(
                Experiment.job_params["algorithm"].astext == algorithm
            )
        if date_from:
            start_dt = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
            query = query.where(Experiment.created_at >= start_dt)
            count_query = count_query.where(Experiment.created_at >= start_dt)
        if date_to:
            end_dt = datetime.combine(date_to, time.max, tzinfo=timezone.utc)
            query = query.where(Experiment.created_at <= end_dt)
            count_query = count_query.where(Experiment.created_at <= end_dt)

        sort_map = {
            "created_at_desc": Experiment.created_at.desc(),
            "created_at_asc": Experiment.created_at.asc(),
            "title_asc": Experiment.title.asc(),
            "title_desc": Experiment.title.desc(),
            "status_asc": Experiment.status.asc(),
        }
        query = query.order_by(sort_map.get(sort, Experiment.created_at.desc()))
        query = query.limit(limit).offset(offset)

        total = int((await self.db.execute(count_query)).scalar_one())
        rows = (await self.db.execute(query)).all()
        items = [
            ExperimentBrowseItem(
                id=experiment.id,
                title=experiment.title,
                status=experiment.status,
                algorithm=self._algorithm_from_job(experiment.job_params),
                image_id=experiment.image_id,
                image_name=image_name,
                progress_percent=experiment.progress_percent,
                created_at=experiment.created_at,
                started_at=experiment.started_at,
                finished_at=experiment.finished_at,
                duration_ms=self._duration_ms(experiment),
            )
            for experiment, image_name in rows
        ]
        return items, total

    async def clone_experiment(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        source = await self.get_by_id(experiment_id, user)
        clone = Experiment(
            id=uuid.uuid4(),
            image_id=source.image_id,
            user_id=user.id,
            title=f"{source.title} (nusxa)",
            description=source.description,
            status=ExperimentStatus.PENDING.value,
            job_params=source.job_params,
            parent_experiment_id=source.id,
            comparison_protocol=source.comparison_protocol,
            methodology_version=source.methodology_version,
        )
        self.db.add(clone)
        await self.db.flush()
        return clone

    async def rerun_experiment(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        experiment = await self.get_by_id(experiment_id, user)
        if not experiment.job_params:
            raise HTTPException(status_code=400, detail="Experiment has no saved run parameters")
        request = ExperimentRunRequest.model_validate(experiment.job_params)
        return await self.enqueue_run(experiment_id, request, user)

    async def delete(
        self, experiment_id: uuid.UUID, user: User, *, permanent: bool = False
    ) -> dict:
        if permanent:
            await self.hard_delete(experiment_id, user)
            return {"message": "Experiment permanently deleted", "mode": "hard"}
        await self.soft_delete(experiment_id, user)
        return {"message": "Experiment archived", "mode": "soft"}

    async def enqueue_run(
        self, experiment_id: uuid.UUID, request: ExperimentRunRequest, user: User
    ) -> Experiment:
        if request.algorithm not in ALGORITHMS:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown algorithm: {request.algorithm}. "
                f"Valid options: {', '.join(sorted(ALGORITHMS))}",
            )

        experiment = await self.get_by_id(experiment_id, user)

        if experiment.status in ACTIVE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="Experiment is already queued or running.",
            )

        from app.services.image_service import ImageService

        image_service = ImageService(self.db, self.settings)
        await image_service.get_by_id(experiment.image_id, user)

        experiment.status = ExperimentStatus.QUEUED.value
        experiment.job_params = request.model_dump(mode="json")
        experiment.comparison_protocol = request.comparison_protocol or "fair_v1"
        from app.core.fair_comparison import METHODOLOGY_VERSION

        experiment.methodology_version = METHODOLOGY_VERSION
        experiment.experiment_seed = request.seed
        experiment.progress_percent = 0.0
        experiment.current_generation = None
        experiment.started_at = None
        experiment.finished_at = None
        experiment.completed_at = None
        experiment.error_message = None
        experiment.cancel_requested = False
        await self.db.flush()

        task_id = enqueue_experiment_run(experiment.id)
        experiment.celery_task_id = task_id
        await self.db.flush()

        logger.info(
            "Experiment %s queued (task %s)",
            experiment.id,
            task_id,
        )
        return experiment

    async def get_status(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        return await self.get_by_id(experiment_id, user)

    async def cancel(self, experiment_id: uuid.UUID, user: User) -> Experiment:
        experiment = await self.get_by_id(experiment_id, user)

        if experiment.status not in ACTIVE_STATUSES:
            raise HTTPException(
                status_code=409,
                detail="Only queued or running experiments can be cancelled.",
            )

        experiment.cancel_requested = True
        if experiment.celery_task_id:
            revoke_experiment_task(experiment.celery_task_id)

        if experiment.status == ExperimentStatus.QUEUED.value:
            experiment.status = ExperimentStatus.CANCELLED.value
            from datetime import datetime, timezone

            experiment.finished_at = datetime.now(timezone.utc)
            await self.db.flush()

        return experiment
