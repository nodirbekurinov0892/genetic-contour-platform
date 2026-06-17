import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.services.research_cleanup_service import ResearchCleanupService
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/account", tags=["account"])


class ResearchCleanupRequest(BaseModel):
    confirm_phrase: str = Field(min_length=1, max_length=128)


@router.post("/cleanup/my-research-data")
@limiter.limit("3/hour")
async def cleanup_my_research_data(
    request: Request,
    body: ResearchCleanupRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ResearchCleanupService(db, settings)
    return await service.cleanup_my_research_data(
        current_user,
        confirm_phrase=body.confirm_phrase,
    )
