"""Professional comparison center: multi-experiment, benchmark summary, global dataset ranking."""

from __future__ import annotations

import uuid
from statistics import mean, pstdev

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.statistics import histogram_bins
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkLeaderboard, BenchmarkRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User
from app.services.benchmark_service import BenchmarkService
from app.services.experiment_service import ExperimentService

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")
_MAX_MULTI = 100


def _avg(vals: list[float]) -> float | None:
    return round(mean(vals), 4) if vals else None


def _std(vals: list[float]) -> float | None:
    return round(pstdev(vals), 4) if len(vals) > 1 else (0.0 if vals else None)


def _rank_table(rows: list[dict]) -> list[dict]:
    rows.sort(
        key=lambda r: (
            r.get("avg_iou") or 0,
            r.get("avg_f1") or 0,
            r.get("avg_dice") or 0,
        ),
        reverse=True,
    )
    for i, row in enumerate(rows, start=1):
        row["rank"] = i
    return rows


class ComparisonCenterService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def _has_supervised_metrics(self, experiment: Experiment) -> bool:
        for ar in experiment.algorithm_runs:
            if ar.algorithm_name in _EDGE_ALGORITHMS and ar.metrics and ar.metrics[0].iou is not None:
                return True
        return False

    async def compare_multi_experiments(
        self, experiment_ids: list[uuid.UUID], user: User
    ) -> dict:
        if not experiment_ids:
            return self._empty_multi("Kamida bitta tajriba tanlang")
        if len(experiment_ids) > _MAX_MULTI:
            return self._empty_multi(f"Maksimum {_MAX_MULTI} tajriba tanlash mumkin")
        if len(set(experiment_ids)) != len(experiment_ids):
            return self._empty_multi("Takroriy tajriba ID lari ruxsat etilmaydi")

        exp_service = ExperimentService(self.db, self.settings)
        included_ids: list[uuid.UUID] = []
        excluded: list[dict] = []

        for eid in experiment_ids:
            try:
                exp = await exp_service.get_by_id(eid, user)
            except HTTPException:
                excluded.append({
                    "experiment_id": str(eid),
                    "title": None,
                    "reason": "Tajriba topilmadi",
                })
                continue
            if exp.status != "completed":
                excluded.append({
                    "experiment_id": str(eid),
                    "title": exp.title,
                    "reason": "Tajriba yakunlanmagan",
                })
                continue
            img = await self.db.get(Image, exp.image_id)
            if not img or not img.ground_truth_storage_key:
                excluded.append({
                    "experiment_id": str(eid),
                    "title": exp.title,
                    "reason": "Ground Truth yo'q",
                })
                continue
            result = await self.db.execute(
                select(Experiment)
                .where(Experiment.id == eid)
                .options(selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics))
            )
            loaded = result.scalar_one()
            if not await self._has_supervised_metrics(loaded):
                excluded.append({
                    "experiment_id": str(eid),
                    "title": exp.title,
                    "reason": "Supervised metrikalar yo'q",
                })
                continue
            included_ids.append(eid)

        if not included_ids:
            return {
                "mode": "multi_experiment",
                "status": "empty",
                "message": "Ilmiy reyting uchun GT va supervised metrikali yakunlangan tajribalar kerak.",
                "experiment_count": len(experiment_ids),
                "included_count": 0,
                "excluded_experiments": excluded,
                "table": [],
                "charts": {},
            }

        result = await self.db.execute(
            select(Experiment)
            .where(Experiment.id.in_(included_ids))
            .options(selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics))
        )
        loaded = list(result.scalars().all())

        buckets: dict[str, dict[str, list[float]]] = {
            a: {
                "iou": [],
                "f1_score": [],
                "dice_coefficient": [],
                "precision": [],
                "recall": [],
                "runtime_ms": [],
            }
            for a in _EDGE_ALGORITHMS
        }
        for exp in loaded:
            for ar in exp.algorithm_runs:
                if ar.algorithm_name not in buckets or not ar.metrics:
                    continue
                m = ar.metrics[0]
                if m.iou is None:
                    continue
                b = buckets[ar.algorithm_name]
                b["iou"].append(float(m.iou))
                if m.f1_score is not None:
                    b["f1_score"].append(float(m.f1_score))
                if m.dice_coefficient is not None:
                    b["dice_coefficient"].append(float(m.dice_coefficient))
                if m.precision is not None:
                    b["precision"].append(float(m.precision))
                if m.recall is not None:
                    b["recall"].append(float(m.recall))
                if m.runtime_ms is not None:
                    b["runtime_ms"].append(float(m.runtime_ms))

        table: list[dict] = []
        for algo, metrics in buckets.items():
            if not metrics["iou"]:
                continue
            table.append({
                "algorithm": algo,
                "avg_iou": _avg(metrics["iou"]),
                "avg_f1": _avg(metrics["f1_score"]),
                "avg_dice": _avg(metrics["dice_coefficient"]),
                "avg_precision": _avg(metrics["precision"]),
                "avg_recall": _avg(metrics["recall"]),
                "avg_runtime_ms": round(mean(metrics["runtime_ms"]), 1) if metrics["runtime_ms"] else None,
                "std_iou": _std(metrics["iou"]),
                "std_f1": _std(metrics["f1_score"]),
                "sample_count": len(metrics["iou"]),
            })
        table = _rank_table(table)

        charts = {
            "avg_iou": [{"algorithm": r["algorithm"], "value": r["avg_iou"]} for r in table],
            "avg_f1": [{"algorithm": r["algorithm"], "value": r["avg_f1"]} for r in table],
            "avg_dice": [{"algorithm": r["algorithm"], "value": r["avg_dice"]} for r in table],
            "avg_runtime_ms": [{"algorithm": r["algorithm"], "value": r["avg_runtime_ms"]} for r in table],
            "sample_count": [{"algorithm": r["algorithm"], "value": r["sample_count"]} for r in table],
            "histogram_iou": histogram_bins(
                [v for r in table for v in [r["avg_iou"]] if v is not None]
            ),
        }

        return {
            "mode": "multi_experiment",
            "status": "ready",
            "experiment_count": len(experiment_ids),
            "included_count": len(included_ids),
            "excluded_experiments": excluded,
            "table": table,
            "charts": charts,
        }

    async def benchmark_summary(
        self, benchmark_id: uuid.UUID, user: User, *, run_id: uuid.UUID | None = None
    ) -> dict:
        bench_service = BenchmarkService(self.db, self.settings)
        benchmark = await bench_service.get_benchmark(benchmark_id)

        run = None
        if run_id:
            candidate = await self.db.get(BenchmarkRun, run_id)
            if candidate and candidate.benchmark_id == benchmark_id and candidate.user_id == user.id:
                run = candidate
        if run is None:
            run_result = await self.db.execute(
                select(BenchmarkRun)
                .where(BenchmarkRun.benchmark_id == benchmark_id, BenchmarkRun.user_id == user.id)
                .order_by(BenchmarkRun.created_at.desc())
                .limit(1)
            )
            run = run_result.scalar_one_or_none()

        gt_count = 0
        for ds in benchmark.datasets:
            img = await self.db.get(Image, ds.image_id)
            if img and img.ground_truth_storage_key:
                gt_count += 1

        base = {
            "mode": "benchmark_summary",
            "benchmark_id": str(benchmark_id),
            "benchmark_name": benchmark.name,
            "image_count": len(benchmark.datasets),
            "gt_count": gt_count,
            "table": [],
            "leaderboard": [],
            "charts": {},
        }

        if not run:
            return {
                **base,
                "status": "no_run",
                "message": "Bu benchmark hali ishga tushirilmagan. Run Benchmark tugmasini bosing.",
                "run_id": None,
                "actions": ["run_benchmark", "view_benchmark"],
            }

        run = await bench_service.refresh_run_status(run.id, user)
        exp_result = await self.db.execute(
            select(Experiment).where(Experiment.benchmark_run_id == run.id)
        )
        experiments = list(exp_result.scalars().all())
        failed_count = sum(1 for e in experiments if e.status == "failed")
        metric_count = await self.db.scalar(
            select(func.count())
            .select_from(Metric)
            .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
            .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
            .where(Experiment.benchmark_run_id == run.id)
        )

        summary_counts = {
            "run_id": str(run.id),
            "run_status": run.status,
            "cohort_size": run.cohort_size,
            "completed_count": run.completed_count,
            "failed_count": failed_count,
            "algorithm_run_count": metric_count or 0,
            "progress_percent": round(100 * run.completed_count / run.cohort_size, 2) if run.cohort_size else 0,
        }

        if run.status == "running":
            return {
                **base,
                **summary_counts,
                "status": "running",
                "message": "Benchmark hozir ishlayapti. Progress kuzatilmoqda.",
                "actions": ["view_progress", "cancel_run"],
            }

        if run.status != "completed":
            return {
                **base,
                **summary_counts,
                "status": run.status,
                "message": "Benchmark run muvaffaqiyatsiz yoki to'xtatilgan. Qayta urinib ko'ring.",
                "actions": ["retry_failed", "run_benchmark"],
            }

        lb = await bench_service.get_leaderboard(benchmark_id, run.id, user_id=user.id)
        table = []
        charts_iou = []
        for entry in lb:
            agg = (run.aggregate_metrics_json or {}).get(entry.algorithm_name, {})
            table.append({
                "algorithm": entry.algorithm_name,
                "rank": entry.rank,
                "avg_iou": entry.avg_iou,
                "avg_f1": entry.avg_f1,
                "avg_dice": entry.avg_dice,
                "avg_precision": agg.get("avg_precision"),
                "avg_recall": agg.get("avg_recall"),
                "avg_runtime_ms": entry.avg_runtime_ms,
                "std_iou": (agg.get("iou_statistics") or {}).get("std"),
                "sample_count": entry.sample_count,
                "success_rate": agg.get("success_rate"),
                "failure_rate": agg.get("failure_rate"),
            })
            charts_iou.append({"algorithm": entry.algorithm_name, "value": entry.avg_iou})

        return {
            **base,
            **summary_counts,
            "status": "ready",
            "message": "Benchmark summary tayyor.",
            "aggregate_metrics": run.aggregate_metrics_json or {},
            "table": table,
            "leaderboard": [
                {
                    "algorithm": e.algorithm_name,
                    "rank": e.rank,
                    "avg_iou": e.avg_iou,
                    "avg_f1": e.avg_f1,
                    "avg_dice": e.avg_dice,
                    "avg_runtime_ms": e.avg_runtime_ms,
                    "sample_count": e.sample_count,
                }
                for e in lb
            ],
            "charts": {
                "avg_iou": charts_iou,
                "avg_f1": [{"algorithm": r["algorithm"], "value": r["avg_f1"]} for r in table],
                "avg_dice": [{"algorithm": r["algorithm"], "value": r["avg_dice"]} for r in table],
                "avg_runtime_ms": [{"algorithm": r["algorithm"], "value": r["avg_runtime_ms"]} for r in table],
            },
            "actions": ["export_report", "view_dataset_ranking"],
        }

    async def global_dataset_ranking(self, user: User) -> dict:
        runs = await self.db.execute(
            select(BenchmarkRun)
            .where(BenchmarkRun.user_id == user.id, BenchmarkRun.status == "completed")
            .order_by(BenchmarkRun.finished_at.desc())
        )
        completed_runs = list(runs.scalars().all())
        if not completed_runs:
            return {
                "mode": "dataset_ranking",
                "status": "empty",
                "message": "Dataset reytingini yaratish uchun kamida bitta completed benchmark run kerak.",
                "run_count": 0,
                "table": [],
                "actions": ["create_benchmark", "run_benchmark"],
            }

        from app.services.dataset_ranking_service import DatasetRankingService

        ranking_service = DatasetRankingService(self.db, self.settings)
        all_rows: dict[str, dict] = {}

        for run in completed_runs:
            data = await ranking_service.rank_benchmark_run(run.benchmark_id, run.id, user)
            for row in data.get("table", []):
                key = row.get("image_id") or row.get("dataset")
                if not key:
                    continue
                if key not in all_rows or (row.get("avg_iou") or 0) > (all_rows[key].get("avg_iou") or 0):
                    all_rows[key] = {**row, "benchmark_run_id": str(run.id)}

        table = sorted(all_rows.values(), key=lambda r: r.get("avg_iou") or 0, reverse=True)
        return {
            "mode": "dataset_ranking",
            "status": "ready" if table else "empty",
            "message": "Barcha completed benchmark run'lar bo'yicha dataset reytingi." if table else "Completed run bor, lekin dataset metrikalari topilmadi.",
            "run_count": len(completed_runs),
            "table": table,
            "sorts": {
                "best_dataset": table[0]["image_id"] if table else None,
                "worst_dataset": table[-1]["image_id"] if table else None,
                "most_difficult": max(table, key=lambda r: r.get("difficulty_score", 0), default={}).get("image_id"),
            },
            "actions": [] if table else ["run_benchmark"],
        }

    def _empty_multi(self, message: str) -> dict:
        return {
            "mode": "multi_experiment",
            "status": "empty",
            "message": message,
            "experiment_count": 0,
            "included_count": 0,
            "excluded_experiments": [],
            "table": [],
            "charts": {},
        }
