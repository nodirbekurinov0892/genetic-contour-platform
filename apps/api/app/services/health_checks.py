"""Readiness probes for PostgreSQL, Redis, and storage."""

import logging
from dataclasses import dataclass

import redis
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import text

from app.config import Settings
from app.database import engine

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HealthCheckResult:
    name: str
    ok: bool
    detail: str


async def check_postgres() -> HealthCheckResult:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return HealthCheckResult("postgresql", True, "connected")
    except Exception as exc:
        logger.warning("PostgreSQL readiness check failed: %s", exc)
        return HealthCheckResult("postgresql", False, str(exc))


def check_redis(settings: Settings) -> HealthCheckResult:
    if not settings.uses_celery_queue:
        return HealthCheckResult("redis", True, "skipped (EXPERIMENT_QUEUE_BACKEND=asyncio)")
    if settings.celery_task_always_eager:
        return HealthCheckResult("redis", True, "skipped (CELERY_TASK_ALWAYS_EAGER)")

    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        return HealthCheckResult("redis", True, "connected")
    except redis.RedisError as exc:
        logger.warning("Redis readiness check failed: %s", exc)
        return HealthCheckResult("redis", False, str(exc))


def check_storage(settings: Settings) -> HealthCheckResult:
    backend = settings.storage_backend.strip().lower()
    if backend == "local":
        return _check_local_storage(settings)
    if backend == "s3":
        return _check_s3_storage(settings)
    return HealthCheckResult("storage", False, f"unknown backend: {backend}")


def _check_local_storage(settings: Settings) -> HealthCheckResult:
    probe = settings.upload_path / ".healthcheck"
    try:
        settings.upload_path.mkdir(parents=True, exist_ok=True)
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        return HealthCheckResult("storage", True, "local directories writable")
    except OSError as exc:
        logger.warning("Local storage readiness check failed: %s", exc)
        return HealthCheckResult("storage", False, str(exc))


def _check_s3_storage(settings: Settings) -> HealthCheckResult:
    import boto3
    from botocore.client import Config

    try:
        client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region or None,
            config=Config(signature_version="s3v4", connect_timeout=3, read_timeout=3),
        )
        client.head_bucket(Bucket=settings.s3_bucket_name)
        return HealthCheckResult("storage", True, f"s3 bucket reachable: {settings.s3_bucket_name}")
    except (ClientError, BotoCoreError, OSError) as exc:
        logger.warning("S3 storage readiness check failed: %s", exc)
        return HealthCheckResult("storage", False, str(exc))


async def run_readiness_checks(settings: Settings) -> list[HealthCheckResult]:
    postgres = await check_postgres()
    redis_result = check_redis(settings)
    storage = check_storage(settings)
    return [postgres, redis_result, storage]
