import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.experiment import (
    AlgorithmRunResponse,
    ExperimentCreate,
    ExperimentJobResponse,
    ExperimentResponse,
    ExperimentResultsResponse,
    ExperimentRunRequest,
    ExperimentStatusResponse,
    GenerationHistoryResponse,
    MetricResponse,
    ResultImageResponse,
)
from app.services.experiment_service import ExperimentService
from app.services.report_service import ReportService
from app.services.storage import StorageService
from app.utils.media_urls import resolve_public_url
from app.utils.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/experiments", tags=["experiments"])


def _to_result_image_response(result_image, settings: Settings) -> ResultImageResponse:
    storage = StorageService(settings)
    return ResultImageResponse(
        id=result_image.id,
        type=result_image.type,
        storage_key=result_image.storage_key,
        public_url=result_image.public_url,
        file_path=result_image.file_path or result_image.storage_key,
        url=resolve_public_url(
            storage=storage,
            settings=settings,
            storage_key=result_image.storage_key,
            public_url=result_image.public_url,
            file_path=result_image.file_path,
        ),
    )


def _to_algorithm_run_response(run, settings: Settings) -> AlgorithmRunResponse:
    return AlgorithmRunResponse(
        id=run.id,
        algorithm_name=run.algorithm_name,
        parameters_json=run.parameters_json,
        result_json=run.result_json,
        runtime_ms=run.runtime_ms,
        status=run.status,
        metrics=[MetricResponse.model_validate(m) for m in run.metrics],
        result_images=[
            _to_result_image_response(ri, settings)
            for ri in run.result_images
        ],
        generation_history=[
            GenerationHistoryResponse.model_validate(g)
            for g in sorted(run.generation_history, key=lambda x: x.generation)
        ],
    )


@router.post("", response_model=ExperimentResponse)
async def create_experiment(
    data: ExperimentCreate,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.create(data, current_user)
    return ExperimentResponse.model_validate(experiment)


@router.get("", response_model=list[ExperimentResponse])
async def list_experiments(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiments = await service.list_all(current_user, limit=limit, offset=offset)
    return [ExperimentResponse.model_validate(e) for e in experiments]


@router.get("/{experiment_id}", response_model=ExperimentResponse)
async def get_experiment(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.get_by_id(experiment_id, current_user)
    return ExperimentResponse.model_validate(experiment)


@router.get("/{experiment_id}/status", response_model=ExperimentStatusResponse)
async def get_experiment_status(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.get_status(experiment_id, current_user)
    return ExperimentStatusResponse(
        job_id=experiment.id,
        status=experiment.status,
        progress_percent=experiment.progress_percent,
        current_generation=experiment.current_generation,
        started_at=experiment.started_at,
        finished_at=experiment.finished_at,
        error_message=experiment.error_message,
    )


@router.post("/{experiment_id}/run", response_model=ExperimentJobResponse)
@limiter.limit("30/hour")
async def run_experiment(
    request: Request,
    experiment_id: uuid.UUID,
    body: ExperimentRunRequest,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.enqueue_run(experiment_id, body, current_user)
    return ExperimentJobResponse(job_id=experiment.id, status=experiment.status)


@router.post("/{experiment_id}/cancel", response_model=ExperimentStatusResponse)
async def cancel_experiment(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.cancel(experiment_id, current_user)
    return ExperimentStatusResponse(
        job_id=experiment.id,
        status=experiment.status,
        progress_percent=experiment.progress_percent,
        current_generation=experiment.current_generation,
        started_at=experiment.started_at,
        finished_at=experiment.finished_at,
        error_message=experiment.error_message,
    )


@router.get("/{experiment_id}/results", response_model=ExperimentResultsResponse)
async def get_experiment_results(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.get_by_id(experiment_id, current_user)
    return ExperimentResultsResponse(
        experiment=ExperimentResponse.model_validate(experiment),
        algorithm_runs=[
            _to_algorithm_run_response(r, settings) for r in experiment.algorithm_runs
        ],
    )


@router.get("/{experiment_id}/report")
async def get_experiment_report(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    report_service = ReportService(db, settings)
    report_data = await report_service.build_report_data(experiment_id, current_user)
    return JSONResponse(content=report_data)


@router.get("/{experiment_id}/report/csv")
async def get_experiment_report_csv(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    report_service = ReportService(db, settings)
    report_data = await report_service.build_report_data(experiment_id, current_user)
    csv_content = report_service.build_csv(report_data)
    filename = f"experiment-{experiment_id}-report.csv"
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{experiment_id}/report/pdf")
async def get_experiment_report_pdf(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    report_service = ReportService(db, settings)
    try:
        pdf_bytes = await report_service.generate_pdf(experiment_id, current_user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "PDF generation failed for experiment %s",
            experiment_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"PDF report generation failed: {type(exc).__name__}: {exc}",
        ) from exc

    filename = f"experiment-{experiment_id}-report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{experiment_id}")
async def delete_experiment(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    await service.delete(experiment_id, current_user)
    return {"message": "Experiment deleted"}
