from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.algorithm_run import AlgorithmRun
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.metric import Metric
from app.models.user import User

router = APIRouter(prefix="/api/platform", tags=["platform"])


@router.get("/performance-audit")
async def performance_audit(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Real table row counts and known bottleneck notes for the current user scope."""
    user_id = current_user.id
    table_counts = {}
    for table, model in [
        ("experiments", Experiment),
        ("images", Image),
        ("algorithm_runs", AlgorithmRun),
        ("metrics", Metric),
    ]:
        if model is Experiment or model is Image:
            count = await db.scalar(
                select(func.count()).select_from(model).where(model.user_id == user_id)
            )
        elif model is AlgorithmRun:
            count = await db.scalar(
                select(func.count())
                .select_from(AlgorithmRun)
                .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
                .where(Experiment.user_id == user_id)
            )
        else:
            count = await db.scalar(
                select(func.count())
                .select_from(Metric)
                .join(AlgorithmRun, Metric.algorithm_run_id == AlgorithmRun.id)
                .join(Experiment, AlgorithmRun.experiment_id == Experiment.id)
                .where(Experiment.user_id == user_id)
            )
        table_counts[table] = count or 0

    image_bytes = await db.scalar(
        select(func.coalesce(func.sum(Image.size), 0)).where(Image.user_id == user_id)
    )

    return {
        "table_counts": table_counts,
        "largest_table": max(table_counts, key=table_counts.get),
        "storage_consumer_bytes": int(image_bytes or 0),
        "known_bottlenecks": [
            {
                "area": "stats.activity_7d",
                "issue": "7 sequential DB count queries per request",
                "endpoint": "GET /api/stats",
            },
            {
                "area": "benchmark cohort aggregation",
                "issue": "Per-experiment reload in _compute_aggregate_metrics loop",
                "endpoint": "POST /api/benchmarks/{id}/runs",
            },
            {
                "area": "storage audit",
                "issue": "storage.exists() called per object (I/O bound)",
                "endpoint": "GET /api/storage/audit",
            },
            {
                "area": "experiment worker",
                "issue": "GA + compare_all runs CPU-bound in background worker",
                "endpoint": "POST /api/experiments/{id}/run",
            },
        ],
        "slow_endpoints": [
            "POST /api/experiments/{id}/run",
            "GET /api/experiments/{id}/report/pdf",
            "POST /api/benchmarks/{id}/runs",
            "GET /api/analytics/advanced",
        ],
    }


@router.get("/security-audit")
async def security_audit(
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    return {
        "jwt": {"enabled": True, "algorithm": "HS256"},
        "rbac": {
            "roles": ["user", "admin"],
            "team_roles": ["admin", "researcher", "analyst", "viewer"],
            "ownership_model": "user_id per resource",
        },
        "upload_validation": {
            "mime_check": True,
            "size_limit": True,
            "extension_check": True,
        },
        "rate_limiting": {"enabled": True, "library": "slowapi"},
        "storage_access": {
            "backend": settings.storage_backend,
            "media_serve_auth": True,
            "production_local_static": settings.use_local_static_files,
        },
        "trusted_hosts": settings.trusted_hosts_list,
        "cors_origins_count": len(settings.cors_origin_list),
    }


@router.get("/api-explorer")
async def api_explorer(
    request: Request,
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    routes = []
    for route in request.app.routes:
        if hasattr(route, "methods") and hasattr(route, "path"):
            for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
                if route.path.startswith("/api/") or route.path.startswith("/health"):
                    routes.append({"method": method, "path": route.path})
    routes.sort(key=lambda r: (r["path"], r["method"]))
    docs_enabled = settings.api_debug
    return {
        "openapi_url": "/openapi.json" if docs_enabled else None,
        "docs_url": "/docs" if docs_enabled else None,
        "redoc_url": "/redoc" if docs_enabled else None,
        "docs_enabled": docs_enabled,
        "routes": routes,
        "version": request.app.version,
    }
