import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.data_management import BulkExperimentRequest, BulkImageRequest
from app.services.experiment_service import ExperimentService
from app.services.data_management_service import ImageManagementService
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/bulk", tags=["bulk"])


@router.post("/experiments/archive")
@limiter.limit("20/hour")
async def bulk_archive_experiments(
    request: Request,
    body: BulkExperimentRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    count = 0
    for eid in body.experiment_ids:
        await service.archive(eid, current_user)
        count += 1
    return {"archived_count": count}


@router.post("/experiments/delete")
@limiter.limit("20/hour")
async def bulk_delete_experiments(
    request: Request,
    body: BulkExperimentRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    count = 0
    for eid in body.experiment_ids:
        await service.delete(eid, current_user, permanent=body.permanent)
        count += 1
    return {"deleted_count": count, "permanent": body.permanent}


@router.post("/images/delete")
@limiter.limit("20/hour")
async def bulk_delete_images(
    request: Request,
    body: BulkImageRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ImageManagementService(db, settings)
    results = []
    for iid in body.image_ids:
        results.append(
            await service.delete_image(
                iid,
                current_user,
                cascade_experiments=body.cascade_experiments,
                soft=not body.permanent,
            )
        )
    return {"results": results}
