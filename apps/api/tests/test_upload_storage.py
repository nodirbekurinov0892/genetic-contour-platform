"""Integration test: image upload persists via storage abstraction."""

import io

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage

from app.config import get_settings
from app.services.storage import StorageService


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (24, 24), color=(10, 20, 30))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_upload_returns_storage_key_and_readable_file(client: AsyncClient):
    reg = await client.post(
        "/api/auth/register",
        json={"email": "storage-upload@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("sample.png", _make_test_image_bytes(), "image/png")},
    )
    assert response.status_code == 200
    image = response.json()["image"]

    assert image["storage_key"].startswith("uploads/")
    assert image["storage_key"].endswith(".png")
    assert image["url"].startswith("http://testserver/static/uploads/")
    assert image["public_url"]

    storage = StorageService(get_settings())
    assert storage.exists(image["storage_key"])
    assert len(storage.get_bytes(image["storage_key"])) > 0
