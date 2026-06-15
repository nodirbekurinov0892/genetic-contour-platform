"""Storage audit ghost record detection."""

import io

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_ghost_record_audit_detects_missing_original(client: AsyncClient):
    register = await client.post(
        "/api/auth/register",
        json={"email": "audit@example.com", "password": "securepass123"},
    )
    token = register.json()["access_token"]

    upload = await client.post(
        "/api/images/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.png", _make_test_image_bytes(), "image/png")},
    )
    image = upload.json()["image"]
    storage_key = image["storage_key"]

    from app.config import get_settings
    from app.services.storage import StorageService

    storage = StorageService(get_settings())
    storage.delete_file(storage_key)

    audit = await client.get(
        "/api/storage/audit",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert audit.status_code == 200
    data = audit.json()
    assert data["missing_originals"] >= 1
    assert any(r["issue"] == "missing_original" for r in data["broken_records"])
    assert data["severity"] == "critical"
    assert data["repair_available"] is True
