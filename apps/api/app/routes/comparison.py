import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.comparison_center_service import ComparisonCenterService
from app.services.comparison_service import ComparisonService

router = APIRouter(prefix="/api/comparison", tags=["comparison"])


def _parse_ids(ids: str | None) -> list[uuid.UUID]:
    if not ids or not ids.strip():
        return []
    return [uuid.UUID(part.strip()) for part in ids.split(",") if part.strip()]


@router.get("/experiments")
async def compare_experiments(
    experiment_a: uuid.UUID = Query(...),
    experiment_b: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonService(db, settings)
    return await service.compare_experiments(experiment_a, experiment_b, current_user)


@router.get("/multi-experiments")
async def compare_multi_experiments(
    ids: str = Query(..., description="Comma-separated experiment UUIDs"),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonCenterService(db, settings)
    return await service.compare_multi_experiments(_parse_ids(ids), current_user)


@router.get("/algorithms")
async def compare_algorithms(
    algorithm_a: str = Query(...),
    algorithm_b: str = Query(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonService(db, settings)
    return await service.compare_algorithms(algorithm_a, algorithm_b, current_user)


@router.get("/benchmarks")
async def compare_benchmarks(
    benchmark_a: uuid.UUID = Query(...),
    benchmark_b: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonService(db, settings)
    return await service.compare_benchmarks(benchmark_a, benchmark_b, current_user)


@router.get("/benchmark-summary/{benchmark_id}")
async def benchmark_summary(
    benchmark_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonCenterService(db, settings)
    return await service.benchmark_summary(benchmark_id, current_user)


@router.get("/dataset-ranking")
async def global_dataset_ranking(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonCenterService(db, settings)
    return await service.global_dataset_ranking(current_user)


@router.get("/datasets/{benchmark_id}")
async def compare_datasets(
    benchmark_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonService(db, settings)
    return await service.compare_datasets(benchmark_id, current_user)


@router.get("/experiments/charts")
async def compare_experiments_charts(
    experiment_a: uuid.UUID = Query(...),
    experiment_b: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.comparison_charts_service import ComparisonChartsService

    service = ComparisonChartsService(db, settings)
    return await service.experiment_charts(experiment_a, experiment_b, current_user)
