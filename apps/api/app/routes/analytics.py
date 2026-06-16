import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.analytics_service import AnalyticsService
from app.services.comparison_charts_service import compare_algorithms_statistical
from app.services.multi_experiment_service import MultiExperimentAnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class MultiExperimentRequest(BaseModel):
    experiment_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


@router.get("/advanced")
async def get_advanced_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    service = AnalyticsService(db)
    return await service.get_advanced_analytics(current_user)


@router.post("/multi-experiment")
async def multi_experiment_analytics(
    body: MultiExperimentRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = MultiExperimentAnalyticsService(db, settings)
    return await service.analyze(body.experiment_ids, current_user)


@router.get("/statistical-tests")
async def statistical_tests(
    algorithm_a: str = Query(...),
    algorithm_b: str = Query(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    return await compare_algorithms_statistical(db, settings, algorithm_a, algorithm_b, current_user)
