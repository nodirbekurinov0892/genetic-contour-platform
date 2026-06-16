import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.comparison_service import ComparisonService

router = APIRouter(prefix="/api/comparison", tags=["comparison"])


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


@router.get("/datasets/{benchmark_id}")
async def compare_datasets(
    benchmark_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ComparisonService(db, settings)
    return await service.compare_datasets(benchmark_id, current_user)
