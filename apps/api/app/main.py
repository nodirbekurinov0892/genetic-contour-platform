import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.core.platform import API_SERVICE_NAME, PLATFORM_NAME, PLATFORM_SUBTITLE
from app.database import engine
import app.models  # noqa: F401 — register ORM models with Base.metadata
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.utils.request_context import get_request_id
from app.utils.sentry_init import init_sentry
from app.routes import admin, auth, experiments, health, images, media, stats
from app.utils.logging_config import setup_logging
from app.utils.rate_limit import limiter

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(debug=settings.api_debug, json_logs=settings.use_json_logs)
    init_sentry(settings)
    if settings.storage_backend == "local" and not settings.api_debug:
        logger.warning(
            "STORAGE_BACKEND=local with API_DEBUG=false — /static file serving is disabled; use s3 in production"
        )
    logger.info("API started (schema managed by Alembic migrations)")
    if settings.experiment_queue_backend.strip().lower() == "asyncio":
        from app.jobs.recovery import run_startup_recovery_async

        recovery_stats = await run_startup_recovery_async()
        logger.info("Startup job recovery: %s", recovery_stats)
    yield
    await engine.dispose()


app = FastAPI(
    title=f"{PLATFORM_NAME} API",
    description=PLATFORM_SUBTITLE,
    version="0.3.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

if settings.trusted_hosts_list != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

if settings.use_local_static_files:
    app.mount("/static/uploads", StaticFiles(directory=str(settings.upload_path)), name="uploads")
    app.mount("/static/results", StaticFiles(directory=str(settings.results_path)), name="results")

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(stats.router)
app.include_router(images.router)
app.include_router(media.router)
app.include_router(experiments.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        raise exc
    request_id = get_request_id()
    logger.exception("Unhandled error on %s", request.url.path, extra={"request_id": request_id})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
        headers={"X-Request-ID": request_id},
    )
