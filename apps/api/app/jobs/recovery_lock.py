"""Redis distributed lock for one-shot job recovery across workers."""

import logging

import redis

from app.config import Settings

logger = logging.getLogger(__name__)

RECOVERY_LOCK_KEY = "genetic_contour:job_recovery_lock"
RECOVERY_LOCK_TTL_SECONDS = 120


def acquire_recovery_lock(settings: Settings) -> bool:
    """Return True if this process should run recovery."""
    if settings.celery_task_always_eager:
        return True

    try:
        client = redis.from_url(
            settings.redis_url,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        acquired = client.set(
            RECOVERY_LOCK_KEY,
            "1",
            nx=True,
            ex=RECOVERY_LOCK_TTL_SECONDS,
        )
        return bool(acquired)
    except redis.RedisError:
        logger.exception("Failed to acquire job recovery lock — skipping recovery")
        return False


def release_recovery_lock(settings: Settings) -> None:
    if settings.celery_task_always_eager:
        return

    try:
        client = redis.from_url(
            settings.redis_url,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.delete(RECOVERY_LOCK_KEY)
    except redis.RedisError:
        logger.warning("Failed to release job recovery lock", exc_info=True)
