import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.image import ImageResponse, ImageUploadResponse
from app.services.image_service import ImageService
from app.services.storage import StorageService
from app.utils.media_urls import resolve_public_url
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/images", tags=["images"])


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
    return data


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
    return ImageUploadResponse(image=_to_image_response(image, settings))


@router.get("", response_model=list[ImageResponse])
async def list_images(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    images = await service.list_all(current_user, limit=limit, offset=offset)
    return [_to_image_response(img, settings) for img in images]


@router.get("/{image_id}", response_model=ImageResponse)
async def get_image(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageService(db, settings)
    image = await service.get_by_id(image_id, current_user)
    return _to_image_response(image, settings)
