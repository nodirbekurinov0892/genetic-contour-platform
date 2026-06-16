import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.benchmark import (
    BenchmarkCreate,
    BenchmarkDatasetResponse,
    BenchmarkResponse,
    BenchmarkRunResponse,
    LeaderboardEntry,
)
from app.schemas.experiment import ExperimentRunRequest
from app.services.benchmark_service import BenchmarkService
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/benchmarks", tags=["benchmarks"])


def _to_benchmark_response(benchmark, *, include_datasets: bool = False) -> BenchmarkResponse:
    from sqlalchemy import inspect as sa_inspect

    state = sa_inspect(benchmark)
    loaded_datasets = state.dict.get("datasets") or []
    datasets: list[BenchmarkDatasetResponse] = []
    if include_datasets and loaded_datasets:
        datasets = [BenchmarkDatasetResponse.model_validate(ds) for ds in loaded_datasets]
    return BenchmarkResponse(
        id=benchmark.id,
        slug=benchmark.slug,
        name=benchmark.name,
        description=benchmark.description,
        category=benchmark.category,
        methodology_version=benchmark.methodology_version,
        comparison_protocol=benchmark.comparison_protocol,
        is_public=benchmark.is_public,
        created_at=benchmark.created_at,
        dataset_count=len(loaded_datasets),
        datasets=datasets,
    )


@router.get("", response_model=list[BenchmarkResponse])
async def list_benchmarks(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    benchmarks = await service.list_benchmarks()
    return [_to_benchmark_response(b) for b in benchmarks]


@router.post("", response_model=BenchmarkResponse)
@limiter.limit("10/hour")
async def create_benchmark(
    request: Request,
    data: BenchmarkCreate,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    benchmark = await service.create_benchmark(
        slug=data.slug,
        name=data.name,
        description=data.description,
        category=data.category,
        user=current_user,
        image_ids=data.image_ids,
    )
    return _to_benchmark_response(benchmark)


@router.get("/{benchmark_id}", response_model=BenchmarkResponse)
async def get_benchmark(
    benchmark_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    benchmark = await service.get_benchmark(benchmark_id)
    return _to_benchmark_response(benchmark, include_datasets=True)


@router.post("/{benchmark_id}/datasets/{image_id}")
async def add_benchmark_dataset(
    benchmark_id: uuid.UUID,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    entry = await service.add_dataset_image(benchmark_id, image_id, current_user)
    return {"id": str(entry.id), "image_id": str(entry.image_id)}


@router.post("/{benchmark_id}/runs", response_model=BenchmarkRunResponse)
@limiter.limit("5/hour")
async def start_benchmark_run(
    request: Request,
    benchmark_id: uuid.UUID,
    body: ExperimentRunRequest,
    batch_size: int | None = None,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    run = await service.start_cohort_run(
        benchmark_id, current_user, body, batch_size=batch_size
    )
    return BenchmarkRunResponse.model_validate(run)


@router.get("/{benchmark_id}/collection")
async def get_benchmark_collection(
    benchmark_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    return await service.get_collection_stats(benchmark_id)


@router.get("/{benchmark_id}/runs/{run_id}/dataset-ranking")
async def get_dataset_ranking(
    benchmark_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    return await service.get_dataset_ranking(benchmark_id, run_id, current_user)


@router.get("/{benchmark_id}/runs/{run_id}", response_model=BenchmarkRunResponse)
async def get_benchmark_run(
    benchmark_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    run = await service.refresh_run_status(run_id, current_user)
    return BenchmarkRunResponse.model_validate(run)


@router.get("/{benchmark_id}/leaderboard", response_model=list[LeaderboardEntry])
async def get_benchmark_leaderboard(
    benchmark_id: uuid.UUID,
    run_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = BenchmarkService(db, settings)
    entries = await service.get_leaderboard(benchmark_id, run_id)
    return [LeaderboardEntry.model_validate(e) for e in entries]
