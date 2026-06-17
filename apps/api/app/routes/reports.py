import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.data_management import (
    BenchmarkUpdateRequest,
    BulkExperimentRequest,
    BulkImageRequest,
    BulkReportRequest,
    ImageUpdateRequest,
    ReportUpdateRequest,
)
from app.schemas.image import ImageResponse
from app.services.data_management_service import (
    BenchmarkManagementService,
    ImageManagementService,
    ReportManagementService,
    StorageCleanupService,
)
from app.services.experiment_service import ExperimentService
from app.utils.image_response import to_image_response
from app.utils.rate_limit import limiter

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("")
async def list_reports(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ReportManagementService(db, settings)
    return {"items": await service.list_reports(current_user, limit=limit)}


@router.patch("/{report_id}")
@limiter.limit("30/hour")
async def rename_report(
    request: Request,
    report_id: uuid.UUID,
    body: ReportUpdateRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ReportManagementService(db, settings)
    report = await service.update_title(report_id, current_user, body.title)
    return {"id": str(report.id), "title": report.title}


@router.delete("/{report_id}")
@limiter.limit("30/hour")
async def delete_report(
    request: Request,
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ReportManagementService(db, settings)
    await service.delete_report(report_id, current_user)
    return {"message": "Report deleted"}


@router.post("/{report_id}/regenerate")
@limiter.limit("10/hour")
async def regenerate_report(
    request: Request,
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ReportManagementService(db, settings)
    report = await service.regenerate(report_id, current_user)
    return {"id": str(report.id), "storage_key": report.storage_key}


@router.post("/export-zip")
@limiter.limit("10/hour")
async def export_reports_zip(
    request: Request,
    body: BulkReportRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ReportManagementService(db, settings)
    zip_bytes = await service.export_zip(current_user, body.report_ids)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="reports-export.zip"'},
    )
