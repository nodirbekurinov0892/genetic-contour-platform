import asyncio
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import ACTIVE_STATUSES, Experiment, ExperimentStatus
from app.models.user import User
from app.schemas.experiment import ExperimentCreate, ExperimentRunRequest
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
        return experiment

    async def list_all(self, user: User, limit: int = 50, offset: int = 0) -> list[Experiment]:
        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.user_id == user.id)
            .order_by(Experiment.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def delete(self, experiment_id: uuid.UUID, user: User) -> None:
        experiment = await self.get_by_id(experiment_id, user)
        if experiment.status in ACTIVE_STATUSES:
            experiment.cancel_requested = True
            if experiment.celery_task_id:
                revoke_experiment_task(experiment.celery_task_id)
        storage = StorageService(self.settings)
        self.db.delete(experiment)
        await self.db.flush()
        await asyncio.to_thread(storage.delete_prefix, f"results/{experiment.id}")

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
