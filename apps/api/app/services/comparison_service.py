"""Multi-entity comparison from real experiment/benchmark DB data."""

from __future__ import annotations

import uuid
from statistics import mean

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkLeaderboard, BenchmarkRun
from app.models.experiment import Experiment
from app.models.metric import Metric
from app.models.user import User
from app.services.experiment_service import ExperimentService

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


class ComparisonService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def _load_experiment_metrics(self, experiment_id: uuid.UUID, user: User) -> list[dict]:
        exp_service = ExperimentService(self.db, self.settings)
        experiment = await exp_service.get(experiment_id, user)
        if experiment.status != "completed":
            raise HTTPException(status_code=400, detail="Experiment must be completed")
        rows = []
        for ar in experiment.algorithm_runs:
            if ar.algorithm_name not in _EDGE_ALGORITHMS or not ar.metrics:
                continue
            m = ar.metrics[0]
            rows.append({
                "algorithm": ar.algorithm_name,
                "iou": m.iou,
                "f1_score": m.f1_score,
                "dice_coefficient": m.dice_coefficient,
                "precision": m.precision,
                "recall": m.recall,
                "runtime_ms": m.runtime_ms,
                "fitness_score": m.fitness_score,
            })
        return rows

    async def compare_experiments(
        self, experiment_id_a: uuid.UUID, experiment_id_b: uuid.UUID, user: User
    ) -> dict:
        metrics_a = await self._load_experiment_metrics(experiment_id_a, user)
        metrics_b = await self._load_experiment_metrics(experiment_id_b, user)
        by_algo_a = {r["algorithm"]: r for r in metrics_a}
        by_algo_b = {r["algorithm"]: r for r in metrics_b}
        table = []
        chart = []
        for algo in sorted(set(by_algo_a) | set(by_algo_b)):
            a = by_algo_a.get(algo, {})
            b = by_algo_b.get(algo, {})
            table.append({
                "algorithm": algo,
                "experiment_a_iou": a.get("iou"),
                "experiment_b_iou": b.get("iou"),
                "experiment_a_f1": a.get("f1_score"),
                "experiment_b_f1": b.get("f1_score"),
                "iou_delta": (
                    round(float(b["iou"]) - float(a["iou"]), 4)
                    if a.get("iou") is not None and b.get("iou") is not None
                    else None
                ),
            })
            chart.append({
                "algorithm": algo,
                "experiment_a": a.get("iou"),
                "experiment_b": b.get("iou"),
            })
        return {
            "mode": "experiment_vs_experiment",
            "experiment_a": str(experiment_id_a),
            "experiment_b": str(experiment_id_b),
            "table": table,
            "chart": chart,
        }

    async def compare_algorithms(self, algorithm_a: str, algorithm_b: str, user: User) -> dict:
        if algorithm_a not in _EDGE_ALGORITHMS or algorithm_b not in _EDGE_ALGORITHMS:
            raise HTTPException(status_code=400, detail="Invalid algorithm name")
        result = await self.db.execute(
            select(Metric.iou, Metric.f1_score, AlgorithmRun.algorithm_name)
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
        f1_by: dict[str, list[float]] = {algorithm_a: [], algorithm_b: []}
        for iou, f1, algo in result.all():
            if iou is not None:
                by_algo[algo].append(float(iou))
            if f1 is not None:
                f1_by[algo].append(float(f1))
        table = [
            {
                "algorithm": algorithm_a,
                "avg_iou": round(mean(by_algo[algorithm_a]), 4) if by_algo[algorithm_a] else None,
                "avg_f1": round(mean(f1_by[algorithm_a]), 4) if f1_by[algorithm_a] else None,
                "sample_count": len(by_algo[algorithm_a]),
            },
            {
                "algorithm": algorithm_b,
                "avg_iou": round(mean(by_algo[algorithm_b]), 4) if by_algo[algorithm_b] else None,
                "avg_f1": round(mean(f1_by[algorithm_b]), 4) if f1_by[algorithm_b] else None,
                "sample_count": len(by_algo[algorithm_b]),
            },
        ]
        table.sort(key=lambda x: x["avg_iou"] or 0, reverse=True)
        for i, row in enumerate(table, start=1):
            row["rank"] = i
        return {
            "mode": "algorithm_vs_algorithm",
            "table": table,
            "chart": [{"algorithm": r["algorithm"], "avg_iou": r["avg_iou"]} for r in table],
        }

    async def compare_benchmarks(
        self, benchmark_id_a: uuid.UUID, benchmark_id_b: uuid.UUID, user: User
    ) -> dict:
        async def _latest_leaderboard(bid: uuid.UUID) -> list[BenchmarkLeaderboard]:
            run_result = await self.db.execute(
                select(BenchmarkRun)
                .where(
                    BenchmarkRun.benchmark_id == bid,
                    BenchmarkRun.user_id == user.id,
                    BenchmarkRun.status == "completed",
                )
                .order_by(BenchmarkRun.finished_at.desc())
                .limit(1)
            )
            run = run_result.scalar_one_or_none()
            if not run:
                return []
            lb = await self.db.execute(
                select(BenchmarkLeaderboard)
                .where(BenchmarkLeaderboard.benchmark_run_id == run.id)
                .order_by(BenchmarkLeaderboard.rank)
            )
            return list(lb.scalars().all())

        lb_a = await _latest_leaderboard(benchmark_id_a)
        lb_b = await _latest_leaderboard(benchmark_id_b)
        if not lb_a or not lb_b:
            raise HTTPException(
                status_code=404, detail="Completed benchmark runs required for both benchmarks"
            )

        by_a = {e.algorithm_name: e for e in lb_a}
        by_b = {e.algorithm_name: e for e in lb_b}
        table = []
        for algo in _EDGE_ALGORITHMS:
            a, b = by_a.get(algo), by_b.get(algo)
            if not a and not b:
                continue
            table.append({
                "algorithm": algo,
                "benchmark_a_avg_iou": a.avg_iou if a else None,
                "benchmark_b_avg_iou": b.avg_iou if b else None,
                "benchmark_a_rank": a.rank if a else None,
                "benchmark_b_rank": b.rank if b else None,
            })
        return {
            "mode": "benchmark_vs_benchmark",
            "benchmark_a": str(benchmark_id_a),
            "benchmark_b": str(benchmark_id_b),
            "table": table,
            "chart": [
                {
                    "algorithm": r["algorithm"],
                    "benchmark_a": r["benchmark_a_avg_iou"],
                    "benchmark_b": r["benchmark_b_avg_iou"],
                }
                for r in table
            ],
        }

    async def compare_datasets(self, benchmark_id: uuid.UUID, user: User) -> dict:
        result = await self.db.execute(
            select(Benchmark)
            .where(Benchmark.id == benchmark_id)
            .options(selectinload(Benchmark.datasets))
        )
        benchmark = result.scalar_one_or_none()
        if not benchmark:
            raise HTTPException(status_code=404, detail="Benchmark not found")

        run_result = await self.db.execute(
            select(BenchmarkRun)
            .where(
                BenchmarkRun.benchmark_id == benchmark_id,
                BenchmarkRun.user_id == user.id,
                BenchmarkRun.status == "completed",
            )
            .order_by(BenchmarkRun.finished_at.desc())
            .limit(1)
        )
        run = run_result.scalar_one_or_none()
        if not run:
            raise HTTPException(status_code=404, detail="Completed benchmark run required")

        rankings = []
        for ds in benchmark.datasets:
            exp_result = await self.db.execute(
                select(Experiment)
                .where(
                    Experiment.image_id == ds.image_id,
                    Experiment.user_id == user.id,
                    Experiment.benchmark_run_id == run.id,
                    Experiment.status.in_(["completed", "degraded"]),
                )
                .options(selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics))
                .order_by(Experiment.finished_at.desc())
                .limit(1)
            )
            exp = exp_result.scalar_one_or_none()
            if not exp:
                continue
            best_algo = None
            best_iou = -1.0
            for ar in exp.algorithm_runs:
                if ar.algorithm_name not in _EDGE_ALGORITHMS or not ar.metrics:
                    continue
                iou = ar.metrics[0].iou
                if iou is not None and float(iou) > best_iou:
                    best_iou = float(iou)
                    best_algo = ar.algorithm_name
            rankings.append({
                "image_id": str(ds.image_id),
                "winner_algorithm": best_algo,
                "best_iou": round(best_iou, 4) if best_algo else None,
            })
        return {
            "mode": "dataset_ranking",
            "benchmark_id": str(benchmark_id),
            "benchmark_name": benchmark.name,
            "benchmark_run_id": str(run.id),
            "table": rankings,
        }
