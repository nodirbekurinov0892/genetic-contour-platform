"""Admin-only route infrastructure (no admin panel UI)."""

from fastapi import APIRouter, Depends

from app.dependencies.auth import require_admin
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/health")
async def admin_health(_admin: User = Depends(require_admin)):
    return {"status": "ok", "scope": "admin"}
