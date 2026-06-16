"""Multi-experiment analytics across N completed experiments."""

from __future__ import annotations

import uuid
from statistics import mean, median, pstdev, pvariance

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.statistics import confidence_interval_95, histogram_bins, summarize_distribution
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.user import User
from app.services.experiment_service import ExperimentService

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")
_MAX_EXPERIMENTS = 100


class MultiExperimentAnalyticsService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def analyze(self, experiment_ids: list[uuid.UUID], user: User) -> dict:
        if not experiment_ids:
            raise HTTPException(status_code=400, detail="At least one experiment id required")
        if len(experiment_ids) > _MAX_EXPERIMENTS:
            raise HTTPException(status_code=400, detail=f"Maximum {_MAX_EXPERIMENTS} experiments allowed")
        if len(set(experiment_ids)) != len(experiment_ids):
            raise HTTPException(status_code=400, detail="Duplicate experiment ids are not allowed")

        exp_service = ExperimentService(self.db, self.settings)
        experiments: list[Experiment] = []
        for eid in experiment_ids:
            exp = await exp_service.get_by_id(eid, user)
            if exp.status != "completed":
                raise HTTPException(status_code=400, detail=f"Experiment {eid} must be completed")
            experiments.append(exp)

        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.id.in_(experiment_ids))
            .options(selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics))
        )
        loaded = list(result.scalars().all())

        by_algo: dict[str, dict[str, list[float]]] = {
            a: {"iou": [], "f1_score": [], "dice_coefficient": [], "runtime_ms": []} for a in _EDGE_ALGORITHMS
        }
        for exp in loaded:
            for ar in exp.algorithm_runs:
                if ar.algorithm_name not in by_algo or not ar.metrics:
                    continue
                m = ar.metrics[0]
                if m.iou is not None:
                    by_algo[ar.algorithm_name]["iou"].append(float(m.iou))
                if m.f1_score is not None:
                    by_algo[ar.algorithm_name]["f1_score"].append(float(m.f1_score))
                if m.dice_coefficient is not None:
                    by_algo[ar.algorithm_name]["dice_coefficient"].append(float(m.dice_coefficient))
                if m.runtime_ms is not None:
                    by_algo[ar.algorithm_name]["runtime_ms"].append(float(m.runtime_ms))

        algorithms = []
        trend: list[dict] = []
        for algo, metrics in by_algo.items():
            ious = metrics["iou"]
            if not ious:
                continue
            algorithms.append({
                "algorithm": algo,
                "sample_count": len(ious),
                "iou": summarize_distribution(ious),
                "f1_score": summarize_distribution(metrics["f1_score"]),
                "dice_coefficient": summarize_distribution(metrics["dice_coefficient"]),
                "runtime_ms": summarize_distribution(metrics["runtime_ms"]),
                "histogram_iou": histogram_bins(ious),
            })
            trend.append({
                "algorithm": algo,
                "mean_iou": round(mean(ious), 4),
                "median_iou": round(median(ious), 4),
                "std_iou": round(pstdev(ious), 4) if len(ious) > 1 else 0.0,
                "variance_iou": round(pvariance(ious), 6) if len(ious) > 1 else 0.0,
                "confidence_interval_95": confidence_interval_95(ious),
            })

        algorithms.sort(key=lambda x: x["iou"]["mean"] or 0, reverse=True)
        return {
            "mode": "multi_experiment",
            "experiment_count": len(experiment_ids),
            "experiment_ids": [str(e) for e in experiment_ids],
            "algorithms": algorithms,
            "trend_analysis": trend,
            "distribution_analysis": {a["algorithm"]: a["histogram_iou"] for a in algorithms},
        }
