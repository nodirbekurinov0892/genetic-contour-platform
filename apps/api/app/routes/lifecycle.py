import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.image import ImageResponse
from app.services.image_service import ImageService
from app.services.lifecycle_service import LifecycleService
from app.services.storage import StorageService
from app.utils.media_urls import resolve_public_url
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/lifecycle", tags=["lifecycle"])


def _to_image_response(image, settings: Settings) -> ImageResponse:
    storage = StorageService(settings)
    data = ImageResponse.model_validate(image)
    data.url = resolve_public_url(
        storage=storage,
        settings=settings,
        storage_key=image.storage_key,
        public_url=image.public_url,
        file_path=image.file_path,
    )
    data.has_ground_truth = bool(image.ground_truth_storage_key)
    if image.ground_truth_storage_key:
        data.ground_truth_url = resolve_public_url(
            storage=storage,
            settings=settings,
            storage_key=image.ground_truth_storage_key,
            public_url=image.ground_truth_public_url,
            file_path=image.ground_truth_file_path,
        )
    return data


@router.delete("/images/{image_id}")
@limiter.limit("30/hour")
async def delete_image(
    request: Request,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = LifecycleService(db, settings)
    await service.delete_image(image_id, current_user)
    return {"message": "Image deleted"}


@router.delete("/images/{image_id}/ground-truth", response_model=ImageResponse)
@limiter.limit("30/hour")
async def delete_ground_truth(
    request: Request,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = LifecycleService(db, settings)
    image = await service.delete_ground_truth(image_id, current_user)
    return _to_image_response(image, settings)


@router.get("/orphans")
async def list_orphans(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = LifecycleService(db, settings)
    orphans = await service.detect_orphans(current_user)
    return {"orphans": orphans, "count": len(orphans)}


@router.post("/orphans/cleanup")
@limiter.limit("5/hour")
async def cleanup_orphans(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = LifecycleService(db, settings)
    removed = await service.cleanup_orphans(current_user)
    return {"removed": removed}
