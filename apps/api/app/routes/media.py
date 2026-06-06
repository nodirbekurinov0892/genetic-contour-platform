"""Authenticated media streaming from object storage."""

import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.database import get_db
from app.dependencies.auth import get_current_active_user
from app.models.experiment import Experiment
from app.models.image import Image
from app.models.user import User
from app.services.storage import StorageService
from app.utils.ownership import ensure_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media", tags=["media"])

_SAFE_STORAGE_KEY = re.compile(r"^(uploads|results)/[a-zA-Z0-9_\-./]+$")


def _normalize_storage_key(storage_key: str) -> str:
    normalized = storage_key.replace("\\", "/").lstrip("/")
    if ".." in normalized or not _SAFE_STORAGE_KEY.match(normalized):
        raise HTTPException(status_code=400, detail="Invalid storage key")
    return normalized


async def _verify_storage_access(
    db: AsyncSession,
    user: User,
    storage_key: str,
) -> None:
    if storage_key.startswith("uploads/"):
        result = await db.execute(
            select(Image).where(
                (Image.storage_key == storage_key) | (Image.file_path == storage_key)
            )
        )
        image = result.scalar_one_or_none()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        ensure_owner(image.user_id, user.id, "image")
        return

    if storage_key.startswith("results/"):
        parts = storage_key.split("/")
        if len(parts) < 2:
            raise HTTPException(status_code=400, detail="Invalid results storage key")
        try:
            experiment_id = uuid.UUID(parts[1])
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Invalid experiment id in storage key",
            ) from exc

        result = await db.execute(
            select(Experiment).where(Experiment.id == experiment_id)
        )
        experiment = result.scalar_one_or_none()
        if not experiment:
            raise HTTPException(status_code=404, detail="Experiment not found")
        ensure_owner(experiment.user_id, user.id, "experiment")
        return

    raise HTTPException(status_code=400, detail="Unsupported storage key prefix")


@router.get("/serve/{storage_key:path}")
async def serve_media(
    storage_key: str,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_active_user),
):
    normalized = _normalize_storage_key(storage_key)
    await _verify_storage_access(db, current_user, normalized)

    storage = StorageService(settings)
    try:
        key = storage.resolve_storage_key(storage_key=normalized, file_path=None)
        data = storage.get_bytes(key)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to read storage object %s", normalized)
        raise HTTPException(
            status_code=500,
            detail=f"Storage read failed: {type(exc).__name__}",
        ) from exc

    return Response(
        content=data,
        media_type=storage.guess_content_type(normalized),
        headers={"Cache-Control": "private, max-age=3600"},
    )
