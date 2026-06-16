"""Dataset ranking and difficulty scoring from real experiment metrics."""

from __future__ import annotations

import uuid
from statistics import mean

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")
_DIFFICULTY_BANDS = (
    (0.0, 0.35, "Easy"),
    (0.35, 0.55, "Medium"),
    (0.55, 0.75, "Hard"),
    (0.75, 1.01, "Expert"),
)


def _difficulty_label(score: float) -> str:
    for lo, hi, label in _DIFFICULTY_BANDS:
        if lo <= score < hi:
            return label
    return "Expert"


class DatasetRankingService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def rank_benchmark_run(
        self, benchmark_id: uuid.UUID, run_id: uuid.UUID, user: User
    ) -> dict:
        from app.services.benchmark_service import BenchmarkService

        benchmark = await BenchmarkService(self.db, self.settings).get_benchmark(benchmark_id)
        run = await self.db.get(BenchmarkRun, run_id)
        if not run or run.benchmark_id != benchmark_id or run.user_id != user.id:
            raise HTTPException(status_code=404, detail="Benchmark run not found")

        exp_result = await self.db.execute(
            select(Experiment)
            .where(Experiment.benchmark_run_id == run_id, Experiment.user_id == user.id)
            .options(selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics))
        )
        by_image = {e.image_id: e for e in exp_result.scalars().all()}

        rows: list[dict] = []
        for ds in sorted(benchmark.datasets, key=lambda d: d.sort_order):
            img = await self.db.get(Image, ds.image_id)
            exp = by_image.get(ds.image_id)
            row = await self._score_dataset_row(img, exp)
            rows.append(row)

        rows.sort(key=lambda r: r["avg_iou"] if r["avg_iou"] is not None else -1, reverse=True)
        return {
            "benchmark_id": str(benchmark_id),
            "benchmark_name": benchmark.name,
            "benchmark_run_id": str(run_id),
            "table": rows,
            "sorts": {
                "best_dataset": rows[0]["image_id"] if rows else None,
                "worst_dataset": rows[-1]["image_id"] if rows else None,
                "most_difficult": max(rows, key=lambda r: r["difficulty_score"], default={}).get("image_id"),
                "most_noisy": max(rows, key=lambda r: r["noise_score"] or 0, default={}).get("image_id"),
                "most_accurate": max(rows, key=lambda r: r["avg_iou"] or 0, default={}).get("image_id"),
            },
        }

    async def rank_user_datasets(self, user: User, *, limit: int = 50) -> dict:
        result = await self.db.execute(
            select(
                Image.id,
                Image.original_name,
                func.avg(Metric.iou),
                func.avg(Metric.f1_score),
                func.avg(Metric.dice_coefficient),
                func.avg(Metric.noise_score),
                func.avg(Metric.edge_density),
                func.avg(Metric.continuity_score),
                func.count(Metric.id),
            )
            .join(Experiment, Experiment.image_id == Image.id)
            .join(AlgorithmRun, AlgorithmRun.experiment_id == Experiment.id)
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .where(
                Image.user_id == user.id,
                Experiment.status == "completed",
                AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
                Metric.iou.isnot(None),
            )
            .group_by(Image.id, Image.original_name)
            .order_by(func.avg(Metric.iou).desc().nullslast())
            .limit(limit)
        )
        rows = []
        for r in result.all():
            avg_iou = float(r[2]) if r[2] is not None else None
            noise = float(r[6]) if r[6] is not None else 0.0
            edge = float(r[7]) if r[7] is not None else 0.0
            continuity = float(r[8]) if r[8] is not None else 0.0
            difficulty = round(1.0 - (avg_iou or 0.0), 4)
            rows.append({
                "dataset": r[1],
                "image_id": str(r[0]),
                "images": 1,
                "avg_iou": round(avg_iou, 4) if avg_iou is not None else None,
                "avg_f1": round(float(r[3]), 4) if r[3] is not None else None,
                "avg_dice": round(float(r[4]), 4) if r[4] is not None else None,
                "winner": None,
                "noise_score": round(noise, 4),
                "edge_complexity": round(edge, 4),
                "object_density": round(edge, 4),
                "contour_fragmentation": round(1.0 - continuity, 4),
                "difficulty_score": difficulty,
                "difficulty_class": _difficulty_label(difficulty),
                "metric_samples": r[9],
            })
        return {"mode": "user_datasets", "table": rows}

    async def _score_dataset_row(self, img: Image | None, exp: Experiment | None) -> dict:
        ious: list[float] = []
        f1s: list[float] = []
        dices: list[float] = []
        noises: list[float] = []
        edges: list[float] = []
        continuities: list[float] = []
        winner = None
        best_iou = None

        if exp:
            for ar in exp.algorithm_runs:
                if ar.algorithm_name not in _EDGE_ALGORITHMS or not ar.metrics:
                    continue
                m = ar.metrics[0]
                if m.iou is not None:
                    val = float(m.iou)
                    ious.append(val)
                    if best_iou is None or val > best_iou:
                        best_iou = val
                        winner = ar.algorithm_name
                if m.f1_score is not None:
                    f1s.append(float(m.f1_score))
                if m.dice_coefficient is not None:
                    dices.append(float(m.dice_coefficient))
                if m.noise_score is not None:
                    noises.append(float(m.noise_score))
                if m.edge_density is not None:
                    edges.append(float(m.edge_density))
                if m.continuity_score is not None:
                    continuities.append(float(m.continuity_score))

        avg_iou = mean(ious) if ious else None
        difficulty = round(1.0 - (avg_iou or 0.0), 4)
        noise_score = round(mean(noises), 4) if noises else 0.0
        edge_complexity = round(mean(edges), 4) if edges else 0.0
        contour_frag = round(1.0 - mean(continuities), 4) if continuities else 0.0

        gt_meta = (img.gt_validation_metadata or {}) if img else {}
        object_density = gt_meta.get("metrics", {}).get("foreground_coverage")
        if object_density is None:
            object_density = edge_complexity

        return {
            "dataset": img.original_name if img else "unknown",
            "image_id": str(img.id) if img else None,
            "images": 1,
            "avg_iou": round(avg_iou, 4) if avg_iou is not None else None,
            "avg_f1": round(mean(f1s), 4) if f1s else None,
            "avg_dice": round(mean(dices), 4) if dices else None,
            "winner_algorithm": winner,
            "best_iou": round(best_iou, 4) if best_iou is not None else None,
            "noise_score": noise_score,
            "edge_complexity": edge_complexity,
            "object_density": round(float(object_density), 4) if object_density is not None else None,
            "contour_fragmentation": contour_frag,
            "difficulty_score": difficulty,
            "difficulty_class": _difficulty_label(difficulty),
        }
