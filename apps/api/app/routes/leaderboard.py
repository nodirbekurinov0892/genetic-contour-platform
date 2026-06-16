from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.leaderboard_center_service import LeaderboardCenterService

router = APIRouter(prefix="/api/leaderboard", tags=["leaderboard"])


@router.get("")
async def get_leaderboard_center(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = LeaderboardCenterService(db)
    return await service.get_center(current_user)


@router.get("/algorithms")
async def get_algorithm_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = LeaderboardCenterService(db)
    return {"items": await service._top_algorithms(current_user.id)}


@router.get("/benchmarks")
async def get_benchmark_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = LeaderboardCenterService(db)
    return {"items": await service._top_benchmarks(current_user.id)}


@router.get("/datasets")
async def get_dataset_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = LeaderboardCenterService(db)
    return {"items": await service._top_datasets(current_user.id)}
