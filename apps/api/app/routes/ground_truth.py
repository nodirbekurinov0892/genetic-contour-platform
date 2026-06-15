import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.image import ImageResponse
from app.services.image_service import ImageService
from app.utils.image_response import to_image_response
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/ground-truth", tags=["ground-truth"])


@router.get("", response_model=list[ImageResponse])
async def list_ground_truth(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    images = await service.list_gt_manager(
        current_user, status=status, limit=limit, offset=offset
    )
    return [to_image_response(img, settings) for img in images]


@router.post("/{image_id}/validate", response_model=ImageResponse)
@limiter.limit("30/hour")
async def revalidate_ground_truth(
    request: Request,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    image = await service.revalidate_ground_truth(image_id, current_user)
    return to_image_response(image, settings)


@router.get("/coverage")
async def gt_coverage(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    from sqlalchemy import func, select

    from app.models.image import Image

    user_id = current_user.id
    total = await db.scalar(
        select(func.count()).select_from(Image).where(Image.user_id == user_id)
    )
    with_gt = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(Image.user_id == user_id, Image.ground_truth_storage_key.isnot(None))
    )
    valid = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(
            Image.user_id == user_id,
            Image.gt_validation_status == "valid",
        )
    )
    invalid = await db.scalar(
        select(func.count())
        .select_from(Image)
        .where(
            Image.user_id == user_id,
            Image.gt_validation_status == "invalid",
        )
    )
    total_n = total or 0
    return {
        "total_images": total_n,
        "with_ground_truth": with_gt or 0,
        "valid_gt": valid or 0,
        "invalid_gt": invalid or 0,
        "coverage_pct": round(((with_gt or 0) / total_n) * 100, 1) if total_n else 0.0,
    }
