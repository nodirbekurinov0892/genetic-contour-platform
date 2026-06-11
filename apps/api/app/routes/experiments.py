import asyncio
import json
import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.user import User
from app.schemas.experiment import (
    AlgorithmRunResponse,
    ExperimentBrowseResponse,
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
from app.services.insights_service import generate_insights
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


@router.get("/browse", response_model=ExperimentBrowseResponse)
async def browse_experiments(
    search: str | None = None,
    status: str | None = None,
    algorithm: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = "created_at_desc",
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    items, total = await service.browse(
        current_user,
        search=search,
        status=status,
        algorithm=algorithm,
        date_from=date_from,
        date_to=date_to,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return ExperimentBrowseResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


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


@router.get("/{experiment_id}/stream")
async def stream_experiment_status(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    terminal = {"completed", "failed", "cancelled"}

    async def event_generator():
        while True:
            experiment = await service.get_status(experiment_id, current_user)
            payload = {
                "job_id": str(experiment.id),
                "status": experiment.status,
                "progress_percent": experiment.progress_percent,
                "current_generation": experiment.current_generation,
                "started_at": experiment.started_at.isoformat() if experiment.started_at else None,
                "finished_at": experiment.finished_at.isoformat() if experiment.finished_at else None,
                "error_message": experiment.error_message,
            }
            yield f"data: {json.dumps(payload)}\n\n"
            if experiment.status in terminal:
                break
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/{experiment_id}/insights")
async def get_experiment_insights(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    report_service = ReportService(db, settings)
    report_data = await report_service.build_report_data(experiment_id, current_user)
    metrics_rows = [
        {
            "algorithm": row["algorithm"],
            "algorithm_key": row["algorithm_key"],
            "edge_density": row["edge_density"],
            "continuity_score": row["continuity_score"],
            "noise_score": row["noise_score"],
            "fitness_score": row["fitness_score"],
            "runtime_ms": row["runtime_ms"],
            "precision": row.get("precision"),
            "recall": row.get("recall"),
            "f1_score": row.get("f1_score"),
            "iou": row.get("iou"),
            "dice_coefficient": row.get("dice_coefficient"),
        }
        for row in report_data["metrics"]
    ]
    has_ground_truth = bool(
        report_data.get("scientific_evaluation", {}).get("has_ground_truth")
    )
    return generate_insights(metrics_rows, has_ground_truth=has_ground_truth)


@router.post("/{experiment_id}/clone", response_model=ExperimentResponse)
async def clone_experiment(
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.clone_experiment(experiment_id, current_user)
    return ExperimentResponse.model_validate(experiment)


@router.post("/{experiment_id}/rerun", response_model=ExperimentJobResponse)
@limiter.limit("30/hour")
async def rerun_experiment(
    request: Request,
    experiment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    service = ExperimentService(db, settings)
    experiment = await service.rerun_experiment(experiment_id, current_user)
    return ExperimentJobResponse(job_id=experiment.id, status=experiment.status)


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
