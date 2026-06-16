"""Advanced analytics from real DB metrics — no mock data."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from statistics import mean, median, pstdev, pvariance

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


def _stat_summary(values: list[float]) -> dict[str, float | None]:
    if not values:
        return {"mean": None, "median": None, "std": None, "variance": None, "min": None, "max": None, "count": 0}
    return {
        "mean": round(mean(values), 4),
        "median": round(median(values), 4),
        "std": round(pstdev(values), 4) if len(values) > 1 else 0.0,
        "variance": round(pvariance(values), 6) if len(values) > 1 else 0.0,
        "min": round(min(values), 4),
        "max": round(max(values), 4),
        "count": len(values),
    }


def _histogram(values: list[float], bins: int = 10) -> list[dict[str, float | str]]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if lo == hi:
        return [{"bin": f"{lo:.3f}", "count": len(values), "min": lo, "max": hi}]
    step = (hi - lo) / bins
    buckets = [0] * bins
    for v in values:
        idx = min(int((v - lo) / step), bins - 1) if step > 0 else 0
        buckets[idx] += 1
    out: list[dict[str, float | str]] = []
    for i, count in enumerate(buckets):
        bmin = lo + i * step
        bmax = lo + (i + 1) * step
        out.append({"bin": f"{bmin:.3f}-{bmax:.3f}", "count": count, "min": round(bmin, 4), "max": round(bmax, 4)})
    return out


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _user_metrics(
        self, user_id: uuid.UUID, field: str
    ) -> list[tuple[str, float, float | None, float | None, float | None, int | None]]:
        col = getattr(Metric, field)
        rows = await self.db.execute(
            select(
                AlgorithmRun.algorithm_name,
                col,
                Metric.f1_score,
                Metric.precision,
                Metric.recall,
                Metric.runtime_ms,
            )
            .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
            .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
            .where(
                Experiment.user_id == user_id,
                col.isnot(None),
                AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
            )
        )
        return list(rows.all())

    async def get_advanced_analytics(self, user: User) -> dict:
        user_id = user.id

        total = await self.db.scalar(
            select(func.count()).select_from(Experiment).where(Experiment.user_id == user_id)
        )
        completed = await self.db.scalar(
            select(func.count())
            .select_from(Experiment)
            .where(Experiment.user_id == user_id, Experiment.status == "completed")
        )
        failed = await self.db.scalar(
            select(func.count())
            .select_from(Experiment)
            .where(Experiment.user_id == user_id, Experiment.status == "failed")
        )
        success_rate = round((completed or 0) / (total or 1) * 100, 1) if total else 0.0

        iou_rows = await self._user_metrics(user_id, "iou")
        f1_rows = await self._user_metrics(user_id, "f1_score")
        dice_rows = await self._user_metrics(user_id, "dice_coefficient")

        iou_by_algo: dict[str, list[float]] = {a: [] for a in _EDGE_ALGORITHMS}
        f1_by_algo: dict[str, list[float]] = {a: [] for a in _EDGE_ALGORITHMS}
        dice_by_algo: dict[str, list[float]] = {a: [] for a in _EDGE_ALGORITHMS}
        runtime_by_algo: dict[str, list[int]] = {a: [] for a in _EDGE_ALGORITHMS}
        pr_points: list[dict] = []

        for algo, iou, f1, prec, rec, rt in iou_rows:
            if iou is not None:
                iou_by_algo.setdefault(algo, []).append(float(iou))
            if f1 is not None:
                f1_by_algo.setdefault(algo, []).append(float(f1))
            if prec is not None and rec is not None:
                pr_points.append({
                    "algorithm": algo,
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                    "f1_score": round(float(f1), 4) if f1 is not None else None,
                })
            if rt is not None:
                runtime_by_algo.setdefault(algo, []).append(int(rt))

        for algo, _, f1, _, _, rt in f1_rows:
            if f1 is not None:
                f1_by_algo.setdefault(algo, []).append(float(f1))
            if rt is not None:
                runtime_by_algo.setdefault(algo, []).append(int(rt))

        for algo, dice, _, _, _, rt in dice_rows:
            if dice is not None:
                dice_by_algo.setdefault(algo, []).append(float(dice))
            if rt is not None:
                runtime_by_algo.setdefault(algo, []).append(int(rt))

        leaderboard = []
        for algo in _EDGE_ALGORITHMS:
            ious = iou_by_algo.get(algo, [])
            if not ious:
                continue
            f1s = f1_by_algo.get(algo, [])
            dices = dice_by_algo.get(algo, [])
            runtimes = runtime_by_algo.get(algo, [])
            avg_iou = mean(ious)
            leaderboard.append({
                "algorithm": algo,
                "avg_iou": round(avg_iou, 4),
                "avg_f1": round(mean(f1s), 4) if f1s else None,
                "avg_dice": round(mean(dices), 4) if dices else None,
                "avg_runtime_ms": round(mean(runtimes), 1) if runtimes else None,
                "sample_count": len(ious),
            })
        leaderboard.sort(key=lambda x: x["avg_iou"], reverse=True)
        for i, row in enumerate(leaderboard, start=1):
            row["rank"] = i

        all_ious = [v for vals in iou_by_algo.values() for v in vals]
        top_algo = leaderboard[0]["algorithm"] if leaderboard else None
        worst_algo = leaderboard[-1]["algorithm"] if leaderboard else None

        now = datetime.now(timezone.utc)
        trend_30d: list[dict] = []
        for offset in range(29, -1, -1):
            day = (now - timedelta(days=offset)).date()
            day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
            day_end = day_start + timedelta(days=1)
            count = await self.db.scalar(
                select(func.count())
                .select_from(Experiment)
                .where(
                    Experiment.user_id == user_id,
                    Experiment.created_at >= day_start,
                    Experiment.created_at < day_end,
                )
            )
            avg_day_iou = await self.db.scalar(
                select(func.avg(Metric.iou))
                .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
                .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
                .where(
                    Experiment.user_id == user_id,
                    Experiment.created_at >= day_start,
                    Experiment.created_at < day_end,
                    Metric.iou.isnot(None),
                )
            )
            trend_30d.append({
                "date": day.isoformat(),
                "experiments": count or 0,
                "avg_iou": round(float(avg_day_iou), 4) if avg_day_iou is not None else None,
            })

        dataset_rows = await self.db.execute(
            select(
                Image.id,
                Image.original_name,
                func.avg(Metric.iou),
                func.count(Metric.id),
            )
            .join(Experiment, Experiment.image_id == Image.id)
            .join(AlgorithmRun, AlgorithmRun.experiment_id == Experiment.id)
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .where(Image.user_id == user_id, Metric.iou.isnot(None))
            .group_by(Image.id, Image.original_name)
            .order_by(func.avg(Metric.iou).desc().nullslast())
            .limit(20)
        )
        dataset_performance = [
            {
                "image_id": str(r[0]),
                "name": r[1],
                "avg_iou": round(float(r[2]), 4) if r[2] is not None else None,
                "metric_samples": r[3],
            }
            for r in dataset_rows.all()
        ]

        benchmark_count = await self.db.scalar(
            select(func.count()).select_from(BenchmarkRun).where(BenchmarkRun.user_id == user_id)
        )

        return {
            "summary": {
                "total_experiments": total or 0,
                "completed_experiments": completed or 0,
                "failed_experiments": failed or 0,
                "success_rate_pct": success_rate,
                "benchmark_runs": benchmark_count or 0,
                "algorithms_count": len(_EDGE_ALGORITHMS),
            },
            "algorithm_leaderboard": leaderboard,
            "top_algorithm": top_algo,
            "worst_algorithm": worst_algo,
            "runtime_analytics": {
                algo: _stat_summary([float(x) for x in vals])
                for algo, vals in runtime_by_algo.items()
                if vals
            },
            "iou_distribution": _histogram(all_ious),
            "iou_statistics": _stat_summary(all_ious),
            "f1_distribution": _histogram([v for vals in f1_by_algo.values() for v in vals]),
            "f1_statistics": _stat_summary([v for vals in f1_by_algo.values() for v in vals]),
            "dice_distribution": _histogram([v for vals in dice_by_algo.values() for v in vals]),
            "dice_statistics": _stat_summary([v for vals in dice_by_algo.values() for v in vals]),
            "precision_recall_analysis": pr_points[:200],
            "dataset_performance": dataset_performance,
            "trend_analysis": trend_30d,
        }
