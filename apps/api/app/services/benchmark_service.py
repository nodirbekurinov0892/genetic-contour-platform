"""Benchmark registry, cohort runs, aggregate metrics, leaderboard."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from statistics import mean

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.fair_comparison import DEFAULT_PROTOCOL, METHODOLOGY_VERSION
from app.models.algorithm_run import AlgorithmRun
from app.models.benchmark import Benchmark, BenchmarkDataset, BenchmarkLeaderboard, BenchmarkRun
from app.models.experiment import Experiment, ExperimentStatus
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User
from app.schemas.experiment import ExperimentCreate, ExperimentRunRequest
from app.services.experiment_service import ExperimentService

logger = logging.getLogger(__name__)

_EDGE_ALGORITHMS = ("sobel", "prewitt", "canny", "genetic")


class BenchmarkService:
    def __init__(self, db: AsyncSession, settings: Settings):
        self.db = db
        self.settings = settings

    async def list_benchmarks(self, *, public_only: bool = True) -> list[Benchmark]:
        query = select(Benchmark).options(selectinload(Benchmark.datasets))
        if public_only:
            query = query.where(Benchmark.is_public.is_(True))
        result = await self.db.execute(query.order_by(Benchmark.name))
        return list(result.scalars().all())

    async def get_benchmark(self, benchmark_id: uuid.UUID) -> Benchmark:
        result = await self.db.execute(
            select(Benchmark)
            .where(Benchmark.id == benchmark_id)
            .options(selectinload(Benchmark.datasets).selectinload(BenchmarkDataset.image))
        )
        benchmark = result.scalar_one_or_none()
        if not benchmark:
            raise HTTPException(status_code=404, detail="Benchmark not found")
        return benchmark

    async def _reload_benchmark(self, benchmark_id: uuid.UUID) -> Benchmark:
        result = await self.db.execute(
            select(Benchmark)
            .where(Benchmark.id == benchmark_id)
            .options(selectinload(Benchmark.datasets))
        )
        return result.scalar_one()

    async def create_benchmark(
        self,
        *,
        slug: str,
        name: str,
        description: str | None,
        user: User,
        image_ids: list[uuid.UUID] | None = None,
    ) -> Benchmark:
        existing = await self.db.execute(select(Benchmark).where(Benchmark.slug == slug))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Benchmark slug already exists")

        benchmark = Benchmark(
            id=uuid.uuid4(),
            slug=slug,
            name=name,
            description=description,
            methodology_version=METHODOLOGY_VERSION,
            comparison_protocol=DEFAULT_PROTOCOL,
            is_public=True,
        )
        self.db.add(benchmark)
        await self.db.flush()

        if image_ids:
            for idx, image_id in enumerate(image_ids):
                img = await self.db.get(Image, image_id)
                if not img or img.user_id != user.id:
                    raise HTTPException(status_code=400, detail=f"Invalid image {image_id}")
                self.db.add(
                    BenchmarkDataset(
                        id=uuid.uuid4(),
                        benchmark_id=benchmark.id,
                        image_id=image_id,
                        sort_order=idx,
                    )
                )
            await self.db.flush()
        return await self._reload_benchmark(benchmark.id)

    async def add_dataset_image(
        self, benchmark_id: uuid.UUID, image_id: uuid.UUID, user: User
    ) -> BenchmarkDataset:
        benchmark = await self.get_benchmark(benchmark_id)
        img = await self.db.get(Image, image_id)
        if not img or img.user_id != user.id:
            raise HTTPException(status_code=404, detail="Image not found")
        count = await self.db.scalar(
            select(func.count()).select_from(BenchmarkDataset).where(
                BenchmarkDataset.benchmark_id == benchmark_id
            )
        )
        entry = BenchmarkDataset(
            id=uuid.uuid4(),
            benchmark_id=benchmark.id,
            image_id=image_id,
            sort_order=int(count or 0),
        )
        self.db.add(entry)
        await self.db.flush()
        return entry

    async def start_cohort_run(
        self,
        benchmark_id: uuid.UUID,
        user: User,
        run_request: ExperimentRunRequest,
    ) -> BenchmarkRun:
        benchmark = await self.get_benchmark(benchmark_id)
        datasets = sorted(benchmark.datasets, key=lambda d: d.sort_order)
        if not datasets:
            raise HTTPException(status_code=400, detail="Benchmark has no dataset images")

        run = BenchmarkRun(
            id=uuid.uuid4(),
            benchmark_id=benchmark.id,
            user_id=user.id,
            status="running",
            cohort_size=len(datasets),
            completed_count=0,
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(run)
        await self.db.flush()

        exp_service = ExperimentService(self.db, self.settings)
        for ds in datasets:
            experiment = await exp_service.create(
                ExperimentCreate(
                    image_id=ds.image_id,
                    title=f"{benchmark.name} — {ds.image_id.hex[:8]}",
                    description=f"Benchmark cohort run {run.id}",
                ),
                user,
            )
            experiment.benchmark_run_id = run.id
            experiment.comparison_protocol = benchmark.comparison_protocol
            experiment.methodology_version = benchmark.methodology_version
            experiment.experiment_lineage_json = {
                "benchmark_id": str(benchmark.id),
                "benchmark_run_id": str(run.id),
                "benchmark_slug": benchmark.slug,
            }
            body = run_request.model_copy()
            body.comparison_protocol = benchmark.comparison_protocol
            await exp_service.enqueue_run(experiment.id, body, user)

        await self.db.flush()
        return run

    async def refresh_run_status(self, run_id: uuid.UUID, user: User) -> BenchmarkRun:
        result = await self.db.execute(
            select(BenchmarkRun)
            .where(BenchmarkRun.id == run_id, BenchmarkRun.user_id == user.id)
            .options(selectinload(BenchmarkRun.leaderboard))
        )
        run = result.scalar_one_or_none()
        if not run:
            raise HTTPException(status_code=404, detail="Benchmark run not found")

        exp_result = await self.db.execute(
            select(Experiment).where(Experiment.benchmark_run_id == run_id)
        )
        experiments = list(exp_result.scalars().all())
        completed = sum(1 for e in experiments if e.status == ExperimentStatus.COMPLETED.value)
        run.completed_count = completed

        if completed == len(experiments) and experiments:
            run.status = "completed"
            run.finished_at = datetime.now(timezone.utc)
            await self._compute_aggregate_metrics(run, experiments)
        elif any(e.status == ExperimentStatus.FAILED.value for e in experiments):
            run.status = "failed"
            run.finished_at = datetime.now(timezone.utc)

        await self.db.flush()
        return run

    async def _compute_aggregate_metrics(
        self, run: BenchmarkRun, experiments: list[Experiment]
    ) -> None:
        algo_metrics: dict[str, list[dict]] = {a: [] for a in _EDGE_ALGORITHMS}
        for exp in experiments:
            exp_result = await self.db.execute(
                select(Experiment)
                .where(Experiment.id == exp.id)
                .options(
                    selectinload(Experiment.algorithm_runs).selectinload(AlgorithmRun.metrics)
                )
            )
            loaded = exp_result.scalar_one()
            for ar in loaded.algorithm_runs:
                if ar.algorithm_name not in algo_metrics or not ar.metrics:
                    continue
                m = ar.metrics[0]
                algo_metrics[ar.algorithm_name].append({
                    "iou": m.iou,
                    "f1_score": m.f1_score,
                    "dice_coefficient": m.dice_coefficient,
                    "runtime_ms": m.runtime_ms,
                })

        aggregate: dict[str, dict] = {}
        leaderboard_rows: list[tuple[str, float | None]] = []
        for algo, rows in algo_metrics.items():
            if not rows:
                continue
            ious = [r["iou"] for r in rows if r["iou"] is not None]
            f1s = [r["f1_score"] for r in rows if r["f1_score"] is not None]
            dices = [r["dice_coefficient"] for r in rows if r["dice_coefficient"] is not None]
            runtimes = [r["runtime_ms"] for r in rows if r["runtime_ms"] is not None]
            avg_iou = mean(ious) if ious else None
            aggregate[algo] = {
                "avg_iou": round(avg_iou, 4) if avg_iou is not None else None,
                "avg_f1": round(mean(f1s), 4) if f1s else None,
                "avg_dice": round(mean(dices), 4) if dices else None,
                "avg_runtime_ms": round(mean(runtimes), 1) if runtimes else None,
                "sample_count": len(rows),
            }
            leaderboard_rows.append((algo, avg_iou))

        run.aggregate_metrics_json = aggregate

        await self.db.execute(
            BenchmarkLeaderboard.__table__.delete().where(
                BenchmarkLeaderboard.benchmark_run_id == run.id
            )
        )
        leaderboard_rows.sort(key=lambda x: (x[1] is None, -(x[1] or 0)))
        for rank, (algo, avg_iou) in enumerate(leaderboard_rows, start=1):
            agg = aggregate.get(algo, {})
            self.db.add(
                BenchmarkLeaderboard(
                    id=uuid.uuid4(),
                    benchmark_id=run.benchmark_id,
                    benchmark_run_id=run.id,
                    algorithm_name=algo,
                    rank=rank,
                    avg_iou=agg.get("avg_iou"),
                    avg_f1=agg.get("avg_f1"),
                    avg_dice=agg.get("avg_dice"),
                    avg_runtime_ms=agg.get("avg_runtime_ms"),
                    sample_count=agg.get("sample_count", 0),
                )
            )
        await self.db.flush()

    async def get_leaderboard(
        self, benchmark_id: uuid.UUID, run_id: uuid.UUID | None = None
    ) -> list[BenchmarkLeaderboard]:
        query = select(BenchmarkLeaderboard).where(
            BenchmarkLeaderboard.benchmark_id == benchmark_id
        )
        if run_id:
            query = query.where(BenchmarkLeaderboard.benchmark_run_id == run_id)
        else:
            latest = await self.db.execute(
                select(BenchmarkRun)
                .where(
                    BenchmarkRun.benchmark_id == benchmark_id,
                    BenchmarkRun.status == "completed",
                )
                .order_by(BenchmarkRun.finished_at.desc())
                .limit(1)
            )
            latest_run = latest.scalar_one_or_none()
            if not latest_run:
                return []
            query = query.where(BenchmarkLeaderboard.benchmark_run_id == latest_run.id)

        result = await self.db.execute(query.order_by(BenchmarkLeaderboard.rank))
        return list(result.scalars().all())
