import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.image import ImageResponse
from app.schemas.storage import MarkMissingResponse, RepairMessageResponse, StorageAuditResponse
from app.services.storage_audit_service import StorageAuditService
from app.services.storage_repair_service import StorageRepairService
from app.services.storage_center_service import StorageCenterService
from app.utils.image_response import to_image_response
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/storage", tags=["storage"])


@router.get("/center")
async def storage_center(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = StorageCenterService(db, settings)
    return await service.get_summary(current_user)


@router.get("/audit", response_model=StorageAuditResponse)
async def storage_audit(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = StorageAuditService(db, settings)
    return await service.audit_for_user(current_user)


@router.post("/repair/mark-missing", response_model=MarkMissingResponse)
async def mark_missing_records(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = StorageRepairService(db, settings)
    return await service.mark_missing(current_user)


@router.post("/repair/clear-ground-truth/{image_id}", response_model=ImageResponse)
async def clear_missing_ground_truth(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = StorageRepairService(db, settings)
    image = await service.clear_ground_truth_reference(image_id, current_user)
    return to_image_response(image, settings)


@router.delete("/repair/images/{image_id}", response_model=RepairMessageResponse)
async def delete_broken_image_record(
    image_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = StorageRepairService(db, settings)
    result = await service.delete_image_record(image_id, current_user)
    return RepairMessageResponse(message=result["message"], image_id=result["image_id"])


@router.get("/health-dashboard")
async def storage_health_dashboard(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.data_management_service import StorageCleanupService

    service = StorageCleanupService(db, settings)
    return await service.health_dashboard(current_user)


@router.post("/cleanup/broken-records")
@limiter.limit("10/hour")
async def cleanup_all_broken_records(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.data_management_service import StorageCleanupService

    service = StorageCleanupService(db, settings)
    return await service.cleanup_broken_records(current_user)


@router.post("/cleanup/orphans")
@limiter.limit("10/hour")
async def cleanup_orphan_files(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    from app.services.data_management_service import StorageCleanupService

    service = StorageCleanupService(db, settings)
    return await service.cleanup_orphans(current_user)
