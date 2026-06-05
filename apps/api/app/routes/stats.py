import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    user_id: uuid.UUID = current_user.id

    total_experiments = await db.scalar(
        select(func.count()).select_from(Experiment).where(Experiment.user_id == user_id)
    )
    completed = await db.scalar(
        select(func.count())
        .select_from(Experiment)
        .where(Experiment.user_id == user_id, Experiment.status == "completed")
    )
    failed = await db.scalar(
        select(func.count())
        .select_from(Experiment)
        .where(Experiment.user_id == user_id, Experiment.status == "failed")
    )
    total_images = await db.scalar(
        select(func.count()).select_from(Image).where(Image.user_id == user_id)
    )

    best_fitness = await db.scalar(
        select(func.max(Metric.fitness_score))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(Experiment.user_id == user_id, AlgorithmRun.algorithm_name == "genetic")
    )

    return {
        "total_experiments": total_experiments or 0,
        "completed_experiments": completed or 0,
        "failed_experiments": failed or 0,
        "total_images": total_images or 0,
        "best_ga_fitness": float(best_fitness) if best_fitness is not None else None,
        "algorithms_count": 4,
    }
