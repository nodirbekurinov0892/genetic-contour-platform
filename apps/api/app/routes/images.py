import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.data_management import ImageUpdateRequest
from app.schemas.image import ImageResponse, ImageUploadResponse
from app.services.data_management_service import ImageManagementService
from app.services.image_service import ImageService
from app.utils.image_response import to_image_response
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/images", tags=["images"])


@router.post("/upload", response_model=ImageUploadResponse)
@limiter.limit("20/hour")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    image = await service.upload(file, current_user)
    return ImageUploadResponse(image=to_image_response(image, settings))


@router.get("", response_model=list[ImageResponse])
async def list_images(
    limit: int = 50,
    offset: int = 0,
    search: str | None = None,
    has_ground_truth: bool | None = None,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    images = await service.list_all(
        current_user,
        limit=limit,
        offset=offset,
        search=search,
        has_ground_truth=has_ground_truth,
    )
    return [to_image_response(img, settings) for img in images]


@router.get("/{image_id}/usage")
async def get_image_usage(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    return await service.get_usage(image_id, current_user)


@router.patch("/{image_id}", response_model=ImageResponse)
@limiter.limit("60/hour")
async def update_image(
    request: Request,
    image_id: uuid.UUID,
    body: ImageUpdateRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    image = await service.update_metadata(
        image_id,
        current_user,
        original_name=body.original_name,
        description=body.description,
    )
    return to_image_response(image, settings)


@router.post("/{image_id}/replace", response_model=ImageResponse)
@limiter.limit("20/hour")
async def replace_image_file(
    request: Request,
    image_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    image = await service.replace_file(image_id, file, current_user)
    return to_image_response(image, settings)


@router.post("/{image_id}/ground-truth", response_model=ImageResponse)
@limiter.limit("20/hour")
async def upload_ground_truth(
    request: Request,
    image_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    image = await service.upload_ground_truth(image_id, file, current_user)
    return to_image_response(image, settings)


@router.delete("/{image_id}/gt", response_model=ImageResponse)
@limiter.limit("30/hour")
async def detach_ground_truth(
    request: Request,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    image = await service.detach_gt(image_id, current_user)
    return to_image_response(image, settings)


@router.post("/{image_id}/cleanup-broken")
@limiter.limit("30/hour")
async def cleanup_broken_image(
    request: Request,
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    return await service.cleanup_broken(image_id, current_user)


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    image = await service.get_by_id(image_id, current_user)
    return to_image_response(image, settings)


@router.delete("/{image_id}")
@limiter.limit("30/hour")
async def delete_image(
    request: Request,
    image_id: uuid.UUID,
    cascade_experiments: bool = False,
    permanent: bool = False,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    return await service.delete_image(
        image_id,
        current_user,
        cascade_experiments=cascade_experiments,
        soft=not permanent,
    )
