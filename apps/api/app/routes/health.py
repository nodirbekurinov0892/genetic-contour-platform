from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.services.health_checks import run_readiness_checks

router = APIRouter(tags=["health"])


def _format_check(item) -> dict:
    if item.name == "storage" and item.metadata:
        return {
            "ok": item.ok,
            **item.metadata,
            "detail": item.detail,
        }
    return {"ok": item.ok, "detail": item.detail}


@router.get("/health")
async def health_check():
    """Backward-compatible liveness alias."""
    from app.core.platform import API_SERVICE_NAME

    return {"status": "ok", "service": API_SERVICE_NAME}


@router.get("/health/live")
async def liveness():
    from app.core.platform import API_SERVICE_NAME

    return {"status": "ok", "service": API_SERVICE_NAME}


@router.get("/health/ready")
async def readiness():
    from app.core.platform import API_SERVICE_NAME

    settings = get_settings()
    results = await run_readiness_checks(settings)
    checks = {item.name: _format_check(item) for item in results}
    all_ok = all(item.ok for item in results)
    body = {
        "status": "ok" if all_ok else "degraded",
        "service": API_SERVICE_NAME,
        "checks": checks,
    }
    if all_ok:
        return body
    return JSONResponse(status_code=503, content=body)
