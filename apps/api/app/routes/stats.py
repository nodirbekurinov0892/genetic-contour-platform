import uuid
from datetime import datetime, timedelta, timezone

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

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


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
    paired_images = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(
            Image.user_id == user_id,
            Image.ground_truth_storage_key.isnot(None),
            Image.ground_truth_storage_key != "",
        )
    )

    best_fitness = await db.scalar(
        select(func.max(Metric.fitness_score))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(Experiment.user_id == user_id, AlgorithmRun.algorithm_name == "genetic")
    )

    avg_iou = await db.scalar(
        select(func.avg(Metric.iou))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            Metric.iou.isnot(None),
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
    )
    avg_f1 = await db.scalar(
        select(func.avg(Metric.f1_score))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            Metric.f1_score.isnot(None),
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
    )
    avg_dice = await db.scalar(
        select(func.avg(Metric.dice_coefficient))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            Metric.dice_coefficient.isnot(None),
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
    )
    avg_runtime = await db.scalar(
        select(func.avg(Metric.runtime_ms))
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            Metric.runtime_ms.isnot(None),
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
    )

    algo_rows = await db.execute(
        select(AlgorithmRun.algorithm_name, func.count())
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
        .group_by(AlgorithmRun.algorithm_name)
        .order_by(func.count().desc())
    )
    algo_counts = algo_rows.all()
    most_used_algorithm = algo_counts[0][0] if algo_counts else None

    now = datetime.now(timezone.utc)
    activity_7d: list[dict[str, int | str]] = []
    for offset in range(6, -1, -1):
        day = (now - timedelta(days=offset)).date()
        day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        count = await db.scalar(
            select(func.count())
            .select_from(Experiment)
            .where(
                Experiment.user_id == user_id,
                Experiment.created_at >= day_start,
                Experiment.created_at < day_end,
            )
        )
        activity_7d.append({"date": day.isoformat(), "count": count or 0})

    total = total_images or 0
    paired = paired_images or 0
    gt_coverage_pct = round((paired / total) * 100, 1) if total > 0 else 0.0

    return {
        "total_experiments": total_experiments or 0,
        "completed_experiments": completed or 0,
        "failed_experiments": failed or 0,
        "total_images": total,
        "paired_images": paired,
        "gt_coverage_pct": gt_coverage_pct,
        "best_ga_fitness": float(best_fitness) if best_fitness is not None else None,
        "algorithms_count": 4,
        "avg_iou": round(float(avg_iou), 4) if avg_iou is not None else None,
        "avg_f1": round(float(avg_f1), 4) if avg_f1 is not None else None,
        "avg_dice": round(float(avg_dice), 4) if avg_dice is not None else None,
        "avg_runtime_ms": round(float(avg_runtime), 1) if avg_runtime is not None else None,
        "most_used_algorithm": most_used_algorithm,
        "activity_7d": activity_7d,
    }


@router.get("/v2")
async def get_analytics_v2(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Analytics v2: leaderboards, trends, GT coverage, benchmark summary."""
    base = await get_platform_stats(db=db, current_user=current_user)

    user_id: uuid.UUID = current_user.id
    leaderboard_rows = await db.execute(
        select(
            AlgorithmRun.algorithm_name,
            func.avg(Metric.iou),
            func.avg(Metric.f1_score),
            func.count(),
        )
        .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user_id,
            Metric.iou.isnot(None),
            AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
        )
        .group_by(AlgorithmRun.algorithm_name)
        .order_by(func.avg(Metric.iou).desc().nullslast())
    )
    leaderboard = [
        {
            "algorithm": row[0],
            "avg_iou": round(float(row[1]), 4) if row[1] is not None else None,
            "avg_f1": round(float(row[2]), 4) if row[2] is not None else None,
            "runs": row[3],
        }
        for row in leaderboard_rows.all()
    ]

    from app.models.image import Image

    gt_valid = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(Image.user_id == user_id, Image.gt_validation_status == "valid")
    )
    gt_invalid = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(Image.user_id == user_id, Image.gt_validation_status == "invalid")
    )

    from app.models.benchmark import BenchmarkRun

    benchmark_runs = await db.scalar(
        select(func.count()).select_from(BenchmarkRun).where(BenchmarkRun.user_id == user_id)
    )

    return {
        **base,
        "leaderboard": leaderboard,
        "gt_validation": {
            "valid": gt_valid or 0,
            "invalid": gt_invalid or 0,
        },
        "benchmark_runs": benchmark_runs or 0,
        "trends": {
            "activity_7d": base.get("activity_7d", []),
            "avg_iou": base.get("avg_iou"),
            "avg_f1": base.get("avg_f1"),
        },
    }
