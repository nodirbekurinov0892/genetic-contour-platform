"""Media serve endpoint — missing object returns 404."""

import io

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


async def _register_and_token(client: AsyncClient, email: str) -> str:
    response = await client.post(
        "/api/auth/register",
        json={"email": email, "password": "securepass123"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def _make_test_image_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(120, 80, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_missing_media_returns_404(client: AsyncClient):
    token = await _register_and_token(client, "media404@example.com")

    upload = await client.post(
        "/api/images/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.png", _make_test_image_bytes(), "image/png")},
    )
    assert upload.status_code == 200
    image = upload.json()["image"]
    storage_key = image["storage_key"]

    from app.config import get_settings
    from app.services.storage import StorageService

    storage = StorageService(get_settings())
    storage.delete_file(storage_key)

    response = await client.get(
        f"/api/media/serve/{storage_key}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Fayl topilmadi"
