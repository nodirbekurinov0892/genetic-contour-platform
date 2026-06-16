import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.dataset_ranking_service import DatasetRankingService

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


@router.get("/ranking")
async def get_user_dataset_ranking(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = DatasetRankingService(db, settings)
    return await service.rank_user_datasets(current_user, limit=limit)


@router.get("/ranking/{benchmark_id}/{run_id}")
async def get_benchmark_dataset_ranking(
    benchmark_id: uuid.UUID,
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = DatasetRankingService(db, settings)
    return await service.rank_benchmark_run(benchmark_id, run_id, current_user)
