"""Advanced comparison chart payloads from real metric rows."""

from __future__ import annotations

import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.statistics import (
    cohens_d,
    histogram_bins,
    kruskal_wallis,
    mann_whitney_u,
    paired_t_test,
    significance_conclusion,
    summarize_distribution,
    wilcoxon_signed_rank,
)
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.metric import Metric
from app.models.user import User
from app.services.comparison_service import ComparisonService

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


class ComparisonChartsService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings
        self.comparison = ComparisonService(db, settings)

    async def experiment_charts(
        self, experiment_id_a: uuid.UUID, experiment_id_b: uuid.UUID, user: User
    ) -> dict:
        if experiment_id_a == experiment_id_b:
            raise HTTPException(status_code=400, detail="Experiments must be different")

        metrics_a = await self.comparison._load_experiment_metrics(experiment_id_a, user)
        metrics_b = await self.comparison._load_experiment_metrics(experiment_id_b, user)
        by_a = {r["algorithm"]: r for r in metrics_a}
        by_b = {r["algorithm"]: r for r in metrics_b}

        heatmap = []
        boxplot = []
        radar = []
        correlation_rows: list[dict] = []
        for algo in _EDGE_ALGORITHMS:
            a, b = by_a.get(algo, {}), by_b.get(algo, {})
            heatmap.append({
                "algorithm": algo,
                "experiment_a_iou": a.get("iou"),
                "experiment_b_iou": b.get("iou"),
                "experiment_a_f1": a.get("f1_score"),
                "experiment_b_f1": b.get("f1_score"),
            })
            if a.get("iou") is not None:
                radar.append({"algorithm": algo, "source": "A", "iou": a.get("iou"), "f1": a.get("f1_score"), "dice": a.get("dice_coefficient")})
            if b.get("iou") is not None:
                radar.append({"algorithm": algo, "source": "B", "iou": b.get("iou"), "f1": b.get("f1_score"), "dice": b.get("dice_coefficient")})
            if a.get("iou") is not None or b.get("iou") is not None:
                boxplot.append({"algorithm": algo, "experiment_a": [a.get("iou")] if a.get("iou") is not None else [], "experiment_b": [b.get("iou")] if b.get("iou") is not None else []})
            correlation_rows.append({
                "algorithm": algo,
                "iou_a": a.get("iou"),
                "iou_b": b.get("iou"),
                "runtime_a": a.get("runtime_ms"),
                "runtime_b": b.get("runtime_ms"),
            })

        iou_a = [float(by_a[a]["iou"]) for a in by_a if by_a[a].get("iou") is not None]
        iou_b = [float(by_b[a]["iou"]) for a in by_b if by_b[a].get("iou") is not None]
        paired_a, paired_b = [], []
        for algo in _EDGE_ALGORITHMS:
            if by_a.get(algo, {}).get("iou") is not None and by_b.get(algo, {}).get("iou") is not None:
                paired_a.append(float(by_a[algo]["iou"]))
                paired_b.append(float(by_b[algo]["iou"]))

        wilcoxon = wilcoxon_signed_rank(paired_a, paired_b)
        mann = mann_whitney_u(iou_a, iou_b)
        kruskal = kruskal_wallis(iou_a, iou_b)
        paired = paired_t_test(paired_a, paired_b)

        return {
            "mode": "experiment_charts",
            "experiment_a": str(experiment_id_a),
            "experiment_b": str(experiment_id_b),
            "heatmap": heatmap,
            "boxplot": boxplot,
            "violin": boxplot,
            "histogram": {
                "experiment_a": histogram_bins(iou_a),
                "experiment_b": histogram_bins(iou_b),
            },
            "radar": radar,
            "correlation_matrix": correlation_rows,
            "metric_trend": heatmap,
            "algorithm_ranking": sorted(
                [{"algorithm": h["algorithm"], "avg_iou": mean_pair(h)} for h in heatmap],
                key=lambda x: x["avg_iou"] or 0,
                reverse=True,
            ),
            "statistics": {
                "wilcoxon": wilcoxon,
                "mann_whitney_u": mann,
                "kruskal_wallis": kruskal,
                "paired_t_test": paired,
                "effect_size_cohens_d": cohens_d(paired_a, paired_b),
                "distribution_a": summarize_distribution(iou_a),
                "distribution_b": summarize_distribution(iou_b),
                "conclusions": [
                    c
                    for c in [
                        significance_conclusion("experiment_a", "experiment_b", wilcoxon),
                        significance_conclusion("experiment_a", "experiment_b", mann),
                    ]
                    if c
                ],
            },
        }


def mean_pair(row: dict) -> float | None:
    vals = [v for v in (row.get("experiment_a_iou"), row.get("experiment_b_iou")) if v is not None]
    if not vals:
        return None
    return round(sum(float(v) for v in vals) / len(vals), 4)


async def compare_algorithms_statistical(
    db: AsyncSession,
    settings: Settings,
    algorithm_a: str,
    algorithm_b: str,
    user: User,
) -> dict:
    if algorithm_a == algorithm_b:
        raise HTTPException(status_code=400, detail="Algorithms must be different")
    comparison = ComparisonService(db, settings)
    base = await comparison.compare_algorithms(algorithm_a, algorithm_b, user)

    result = await db.execute(
        select(Metric.iou, AlgorithmRun.algorithm_name)
        .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
        .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
        .where(
            Experiment.user_id == user.id,
            Experiment.status == "completed",
            AlgorithmRun.algorithm_name.in_([algorithm_a, algorithm_b]),
            Metric.iou.isnot(None),
        )
    )
    by_algo: dict[str, list[float]] = {algorithm_a: [], algorithm_b: []}
    for iou, algo in result.all():
        by_algo[algo].append(float(iou))

    mann = mann_whitney_u(by_algo[algorithm_a], by_algo[algorithm_b])
    return {
        **base,
        "statistics": {
            "mann_whitney_u": mann,
            "effect_size_cohens_d": cohens_d(by_algo[algorithm_a], by_algo[algorithm_b]),
            "histogram": {
                algorithm_a: histogram_bins(by_algo[algorithm_a]),
                algorithm_b: histogram_bins(by_algo[algorithm_b]),
            },
            "conclusion": significance_conclusion(algorithm_a, algorithm_b, mann),
        },
    }
