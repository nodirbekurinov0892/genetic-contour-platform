"""Readiness probes for PostgreSQL, Redis, and storage."""

import logging
import uuid
from dataclasses import dataclass, field

import redis
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import text

from app.config import Settings
from app.database import engine
from app.services.storage import StorageService
from app.services.storage.exceptions import StorageObjectNotFoundError

logger = logging.getLogger(__name__)

_HEALTH_PROBE_PREFIX = ".healthcheck/probe-"


@dataclass(frozen=True)
class HealthCheckResult:
    name: str
    ok: bool
    detail: str
    metadata: dict | None = None


@dataclass(frozen=True)
class StorageHealthDetail:
    ok: bool
    backend: str
    read: bool
    write: bool
    delete: bool
    detail: str

    def as_metadata(self) -> dict:
        return {
            "backend": self.backend,
            "read": self.read,
            "write": self.write,
            "delete": self.delete,
        }


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


def _probe_storage_read_write_delete(storage: StorageService) -> tuple[bool, bool, bool]:
    probe_key = f"{_HEALTH_PROBE_PREFIX}{uuid.uuid4().hex}.txt"
    probe_body = b"contour-health-probe"
    write_ok = False
    read_ok = False
    delete_ok = False

    try:
        storage.save_bytes(probe_key, probe_body, "text/plain")
        write_ok = True
    except Exception as exc:
        logger.warning("Storage write probe failed for %s: %s", probe_key, exc)
        return write_ok, read_ok, delete_ok

    try:
        data = storage.get_bytes(probe_key)
        read_ok = data == probe_body
    except (StorageObjectNotFoundError, OSError, ClientError, BotoCoreError) as exc:
        logger.warning("Storage read probe failed for %s: %s", probe_key, exc)

    try:
        delete_ok = storage.delete_file(probe_key)
    except Exception as exc:
        logger.warning("Storage delete probe failed for %s: %s", probe_key, exc)

    return write_ok, read_ok, delete_ok


def check_storage(settings: Settings) -> HealthCheckResult:
    backend = settings.storage_backend.strip().lower()

    if not settings.api_debug and backend == "local":
        logger.error(
            "Production misconfiguration: STORAGE_BACKEND=local with API_DEBUG=false. "
            "Configure Supabase or S3/R2 (STORAGE_BACKEND=supabase or s3) for persistent object storage."
        )
        detail = StorageHealthDetail(
            ok=False,
            backend="local",
            read=False,
            write=False,
            delete=False,
            detail=(
                "STORAGE_BACKEND=local is not allowed in production. "
                "Set STORAGE_BACKEND=supabase or s3 with credentials configured."
            ),
        )
        return HealthCheckResult(
            "storage",
            False,
            detail.detail,
            metadata=detail.as_metadata(),
        )

    if backend == "local":
        return _check_local_storage(settings)
    if backend == "s3":
        return _check_s3_storage(settings)
    if backend == "supabase":
        return _check_supabase_storage(settings)
    return HealthCheckResult("storage", False, f"unknown backend: {backend}")


def _check_local_storage(settings: Settings) -> HealthCheckResult:
    storage = StorageService(settings)
    write_ok, read_ok, delete_ok = _probe_storage_read_write_delete(storage)
    ok = write_ok and read_ok and delete_ok
    detail = StorageHealthDetail(
        ok=ok,
        backend="local",
        read=read_ok,
        write=write_ok,
        delete=delete_ok,
        detail=(
            "local storage read/write/delete probe passed"
            if ok
            else "local storage probe failed — check upload directory permissions"
        ),
    )
    if not ok:
        logger.warning("Local storage readiness probe failed: %s", detail.detail)
    return HealthCheckResult("storage", ok, detail.detail, metadata=detail.as_metadata())


def _check_s3_storage(settings: Settings) -> HealthCheckResult:
    import boto3
    from botocore.client import Config

    bucket_reachable = False
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
        bucket_reachable = True
    except (ClientError, BotoCoreError, OSError) as exc:
        logger.warning("S3 bucket readiness check failed: %s", exc)
        detail = StorageHealthDetail(
            ok=False,
            backend="s3",
            read=False,
            write=False,
            delete=False,
            detail=f"s3 bucket unreachable: {exc}",
        )
        return HealthCheckResult("storage", False, detail.detail, metadata=detail.as_metadata())

    storage = StorageService(settings)
    write_ok, read_ok, delete_ok = _probe_storage_read_write_delete(storage)
    ok = bucket_reachable and write_ok and read_ok and delete_ok
    detail = StorageHealthDetail(
        ok=ok,
        backend="s3",
        read=read_ok,
        write=write_ok,
        delete=delete_ok,
        detail=(
            f"s3 bucket reachable ({settings.s3_bucket_name}); read/write/delete probe passed"
            if ok
            else f"s3 bucket reachable ({settings.s3_bucket_name}) but object probe failed"
        ),
    )
    if not ok:
        logger.warning("S3 storage object probe failed for bucket %s", settings.s3_bucket_name)
    return HealthCheckResult("storage", ok, detail.detail, metadata=detail.as_metadata())


def _check_supabase_storage(settings: Settings) -> HealthCheckResult:
    import httpx

    bucket = settings.supabase_storage_bucket.strip()
    base_url = settings.supabase_url.rstrip("/")
    bucket_reachable = False
    try:
        with httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0)) as client:
            response = client.post(
                f"{base_url}/storage/v1/object/list/{bucket}",
                headers={
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                    "apikey": settings.supabase_service_role_key,
                    "Content-Type": "application/json",
                },
                json={"prefix": "", "limit": 1, "offset": 0},
            )
        if response.status_code >= 400:
            raise OSError(response.text[:300])
        bucket_reachable = True
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("Supabase bucket readiness check failed: %s", exc)
        detail = StorageHealthDetail(
            ok=False,
            backend="supabase",
            read=False,
            write=False,
            delete=False,
            detail=f"supabase bucket unreachable: {exc}",
        )
        return HealthCheckResult("storage", False, detail.detail, metadata=detail.as_metadata())

    storage = StorageService(settings)
    write_ok, read_ok, delete_ok = _probe_storage_read_write_delete(storage)
    ok = bucket_reachable and write_ok and read_ok and delete_ok
    detail = StorageHealthDetail(
        ok=ok,
        backend="supabase",
        read=read_ok,
        write=write_ok,
        delete=delete_ok,
        detail=(
            f"supabase bucket reachable ({bucket}); read/write/delete probe passed"
            if ok
            else f"supabase bucket reachable ({bucket}) but object probe failed"
        ),
    )
    if not ok:
        logger.warning("Supabase storage object probe failed for bucket %s", bucket)
    return HealthCheckResult("storage", ok, detail.detail, metadata=detail.as_metadata())


async def run_readiness_checks(settings: Settings) -> list[HealthCheckResult]:
    postgres = await check_postgres()
    redis_result = check_redis(settings)
    storage = check_storage(settings)
    return [postgres, redis_result, storage]
