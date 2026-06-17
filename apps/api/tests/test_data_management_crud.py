"""Data management CRUD tests."""

import io
import uuid

import pytest
from httpx import AsyncClient
from PIL import Image as PILImage


def _png_bytes() -> bytes:
    img = PILImage.new("RGB", (32, 32), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _register(client: AsyncClient) -> dict[str, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": f"crud-{uuid.uuid4().hex[:8]}@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_experiment_rename(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Original title"},
    )
    exp_id = create.json()["id"]
    patch = await client.patch(
        f"/api/experiments/{exp_id}",
        headers=headers,
        json={"title": "Renamed experiment"},
    )
    assert patch.status_code == 200
    assert patch.json()["title"] == "Renamed experiment"


@pytest.mark.asyncio
async def test_experiment_soft_delete_and_restore(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "To archive"},
    )
    exp_id = create.json()["id"]
    delete = await client.delete(f"/api/experiments/{exp_id}", headers=headers)
    assert delete.status_code == 200
    assert delete.json()["mode"] == "soft"
    restore = await client.post(f"/api/experiments/{exp_id}/restore", headers=headers)
    assert restore.status_code == 200


@pytest.mark.asyncio
async def test_image_delete_blocked_with_experiments(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Linked"},
    )
    delete = await client.delete(f"/api/images/{image_id}", headers=headers)
    assert delete.status_code == 409
    assert "tajribada ishlatilgan" in delete.json()["detail"]


@pytest.mark.asyncio
async def test_user_cannot_delete_other_user_image(client: AsyncClient):
    headers_a = await _register(client)
    headers_b = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers_a,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    delete = await client.delete(f"/api/images/{image_id}", headers=headers_b)
    assert delete.status_code in (403, 404)


@pytest.mark.asyncio
async def test_image_rename(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    patch = await client.patch(
        f"/api/images/{image_id}",
        headers=headers,
        json={"original_name": "renamed.png"},
    )
    assert patch.status_code == 200
    assert patch.json()["original_name"] == "renamed.png"


@pytest.mark.asyncio
async def test_benchmark_update_and_soft_delete(client: AsyncClient):
    headers = await _register(client)
    bench = await client.post(
        "/api/benchmarks",
        headers=headers,
        json={"slug": f"crud-{uuid.uuid4().hex[:6]}", "name": "Bench A"},
    )
    assert bench.status_code == 200
    benchmark_id = bench.json()["id"]
    patch = await client.patch(
        f"/api/benchmarks/{benchmark_id}",
        headers=headers,
        json={"name": "Bench Updated", "description": "New desc"},
    )
    assert patch.status_code == 200
    assert patch.json()["name"] == "Bench Updated"
    delete = await client.delete(f"/api/benchmarks/{benchmark_id}", headers=headers)
    assert delete.status_code == 200
    assert delete.json()["mode"] == "soft"


@pytest.mark.asyncio
async def test_storage_health_dashboard(client: AsyncClient):
    headers = await _register(client)
    response = await client.get("/api/storage/health-dashboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    for key in (
        "health_score",
        "missing_originals",
        "missing_ground_truth",
        "orphan_files",
        "broken_records",
    ):
        assert key in data, f"missing key: {key}"
    assert isinstance(data["health_score"], int)


@pytest.mark.asyncio
async def test_reports_list_empty(client: AsyncClient):
    headers = await _register(client)
    response = await client.get("/api/reports", headers=headers)
    assert response.status_code == 200
    assert response.json()["items"] == []


@pytest.mark.asyncio
async def test_image_archive_linked_experiment(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Linked"},
    )
    archive = await client.delete(
        f"/api/images/{image_id}?archive=true",
        headers=headers,
    )
    assert archive.status_code == 200
    assert archive.json()["mode"] == "soft"


@pytest.mark.asyncio
async def test_image_cascade_delete_with_experiments(client: AsyncClient):
    headers = await _register(client)
    upload = await client.post(
        "/api/images/upload",
        headers=headers,
        files={"file": ("test.png", _png_bytes(), "image/png")},
    )
    image_id = upload.json()["image"]["id"]
    create = await client.post(
        "/api/experiments",
        headers=headers,
        json={"image_id": image_id, "title": "Linked"},
    )
    exp_id = create.json()["id"]
    delete = await client.delete(
        f"/api/images/{image_id}?cascade_experiments=true&permanent=true",
        headers=headers,
    )
    assert delete.status_code == 200
    assert delete.json()["mode"] == "hard"
    exp_get = await client.get(f"/api/experiments/{exp_id}", headers=headers)
    assert exp_get.status_code == 404


@pytest.mark.asyncio
async def test_cleanup_my_research_data_only_current_user(client: AsyncClient):
    headers_a = await _register(client)
    headers_b = await _register(client)
    upload_a = await client.post(
        "/api/images/upload",
        headers=headers_a,
        files={"file": ("a.png", _png_bytes(), "image/png")},
    )
    image_a = upload_a.json()["image"]["id"]
    await client.post(
        "/api/experiments",
        headers=headers_a,
        json={"image_id": image_a, "title": "User A exp"},
    )
    upload_b = await client.post(
        "/api/images/upload",
        headers=headers_b,
        files={"file": ("b.png", _png_bytes(), "image/png")},
    )
    image_b = upload_b.json()["image"]["id"]

    cleanup = await client.post(
        "/api/account/cleanup/my-research-data",
        headers=headers_a,
        json={"confirm_phrase": "DELETE MY RESEARCH DATA"},
    )
    assert cleanup.status_code == 200
    assert cleanup.json()["deleted"]["experiments"] >= 1
    assert cleanup.json()["deleted"]["images"] >= 1

    # User B image must remain.
    img_b = await client.get(f"/api/images/{image_b}", headers=headers_b)
    assert img_b.status_code == 200

    # User A has no experiments left.
    browse_a = await client.get("/api/experiments/browse", headers=headers_a)
    assert browse_a.status_code == 200
    assert browse_a.json()["total"] == 0


@pytest.mark.asyncio
async def test_cleanup_wrong_phrase_rejected(client: AsyncClient):
    headers = await _register(client)
    response = await client.post(
        "/api/account/cleanup/my-research-data",
        headers=headers,
        json={"confirm_phrase": "wrong phrase"},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_leaderboard_empty_after_cleanup(client: AsyncClient):
    headers = await _register(client)
    await client.post(
        "/api/account/cleanup/my-research-data",
        headers=headers,
        json={"confirm_phrase": "DELETE MY RESEARCH DATA"},
    )
    lb = await client.get("/api/leaderboard", headers=headers)
    assert lb.status_code == 200
    body = lb.json()
    entries = body if isinstance(body, list) else body.get("entries", body.get("items", []))
    assert entries == [] or len(entries) == 0
