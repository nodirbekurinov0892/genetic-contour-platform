"""Global leaderboard center from aggregated PostgreSQL metrics."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkLeaderboard, BenchmarkRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


class LeaderboardCenterService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_center(self, user: User) -> dict:
        user_id = user.id
        return {
            "top_algorithms": await self._top_algorithms(user_id),
            "top_datasets": await self._top_datasets(user_id),
            "top_benchmarks": await self._top_benchmarks(user_id),
            "top_experiments": await self._top_experiments(user_id),
            "top_accuracy": await self._top_algorithms(user_id, sort="iou"),
            "top_speed": await self._top_algorithms(user_id, sort="runtime"),
            "top_robustness": await self._top_algorithms(user_id, sort="f1"),
            "top_researchers": await self._top_researchers(user_id),
        }

    async def _top_algorithms(self, user_id, *, sort: str = "iou") -> list[dict]:
        order_col = Metric.iou if sort == "iou" else Metric.f1_score if sort == "f1" else Metric.runtime_ms
        result = await self.db.execute(
            select(
                AlgorithmRun.algorithm_name,
                func.avg(Metric.iou),
                func.avg(Metric.f1_score),
                func.avg(Metric.dice_coefficient),
                func.avg(Metric.runtime_ms),
                func.count(Metric.id),
            )
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
            .where(
                Experiment.user_id == user_id,
                Experiment.status == "completed",
                AlgorithmRun.algorithm_name.in_(_EDGE_ALGORITHMS),
                order_col.isnot(None),
            )
            .group_by(AlgorithmRun.algorithm_name)
            .order_by(func.avg(order_col).desc().nullslast() if sort != "runtime" else func.avg(order_col).asc().nullslast())
        )
        rows = []
        for i, row in enumerate(result.all(), start=1):
            rows.append({
                "rank": i,
                "algorithm": row[0],
                "avg_iou": round(float(row[1]), 4) if row[1] is not None else None,
                "avg_f1": round(float(row[2]), 4) if row[2] is not None else None,
                "avg_dice": round(float(row[3]), 4) if row[3] is not None else None,
                "avg_runtime_ms": round(float(row[4]), 1) if row[4] is not None else None,
                "sample_count": row[5],
            })
        return rows

    async def _top_datasets(self, user_id) -> list[dict]:
        result = await self.db.execute(
            select(Image.original_name, Image.id, func.avg(Metric.iou), func.count(Metric.id))
            .join(Experiment, Experiment.image_id == Image.id)
            .join(AlgorithmRun, AlgorithmRun.experiment_id == Experiment.id)
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .where(Image.user_id == user_id, Metric.iou.isnot(None))
            .group_by(Image.id, Image.original_name)
            .order_by(func.avg(Metric.iou).desc().nullslast())
            .limit(20)
        )
        return [
            {
                "rank": i,
                "dataset": r[0],
                "image_id": str(r[1]),
                "avg_iou": round(float(r[2]), 4) if r[2] is not None else None,
                "sample_count": r[3],
            }
            for i, r in enumerate(result.all(), start=1)
        ]

    async def _top_benchmarks(self, user_id) -> list[dict]:
        result = await self.db.execute(
            select(Benchmark.name, Benchmark.id, BenchmarkLeaderboard.algorithm_name, BenchmarkLeaderboard.avg_iou, BenchmarkLeaderboard.rank)
            .join(BenchmarkRun, BenchmarkRun.benchmark_id == Benchmark.id)
            .join(BenchmarkLeaderboard, BenchmarkLeaderboard.benchmark_run_id == BenchmarkRun.id)
            .where(BenchmarkRun.user_id == user_id, BenchmarkRun.status == "completed", BenchmarkLeaderboard.rank == 1)
            .order_by(BenchmarkLeaderboard.avg_iou.desc().nullslast())
            .limit(20)
        )
        return [
            {
                "rank": i,
                "benchmark": r[0],
                "benchmark_id": str(r[1]),
                "winning_algorithm": r[2],
                "avg_iou": round(float(r[3]), 4) if r[3] is not None else None,
            }
            for i, r in enumerate(result.all(), start=1)
        ]

    async def _top_experiments(self, user_id) -> list[dict]:
        result = await self.db.execute(
            select(Experiment.title, Experiment.id, func.max(Metric.iou), func.avg(Metric.runtime_ms))
            .join(AlgorithmRun, AlgorithmRun.experiment_id == Experiment.id)
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .where(Experiment.user_id == user_id, Experiment.status == "completed")
            .group_by(Experiment.id, Experiment.title)
            .order_by(func.max(Metric.iou).desc().nullslast())
            .limit(20)
        )
        return [
            {
                "rank": i,
                "experiment": r[0],
                "experiment_id": str(r[1]),
                "best_iou": round(float(r[2]), 4) if r[2] is not None else None,
                "avg_runtime_ms": round(float(r[3]), 1) if r[3] is not None else None,
            }
            for i, r in enumerate(result.all(), start=1)
        ]

    async def _top_researchers(self, user_id) -> list[dict]:
        result = await self.db.execute(
            select(User.name, User.email, func.count(Experiment.id), func.avg(Metric.iou))
            .join(Experiment, Experiment.user_id == User.id)
            .join(AlgorithmRun, AlgorithmRun.experiment_id == Experiment.id)
            .join(Metric, Metric.algorithm_run_id == AlgorithmRun.id)
            .where(User.id == user_id, Experiment.status == "completed", Metric.iou.isnot(None))
            .group_by(User.id, User.name, User.email)
        )
        row = result.first()
        if not row:
            return []
        name = row[0] or row[1]
        return [{
            "rank": 1,
            "researcher": name,
            "experiments": row[2],
            "avg_iou": round(float(row[3]), 4) if row[3] is not None else None,
        }]
