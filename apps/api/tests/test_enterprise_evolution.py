"""Enterprise evolution endpoint tests."""

import uuid

import pytest
from httpx import AsyncClient


async def _headers(client: AsyncClient) -> dict[str, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": f"enterprise-{uuid.uuid4().hex[:8]}@example.com", "password": "securepass123"},
    )
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


@pytest.mark.asyncio
async def test_leaderboard_center_returns_sections(client: AsyncClient):
    headers = await _headers(client)
    response = await client.get("/api/leaderboard", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "top_algorithms" in data
    assert "top_datasets" in data
    assert "top_benchmarks" in data
    assert "top_experiments" in data


@pytest.mark.asyncio
async def test_dataset_ranking_user_scope(client: AsyncClient):
    headers = await _headers(client)
    response = await client.get("/api/datasets/ranking", headers=headers)
    assert response.status_code == 200
    assert response.json()["mode"] == "user_datasets"
    assert "table" in response.json()


@pytest.mark.asyncio
async def test_multi_experiment_requires_completed(client: AsyncClient):
    headers = await _headers(client)
    missing = uuid.uuid4()
    response = await client.post(
        "/api/analytics/multi-experiment",
        headers=headers,
        json={"experiment_ids": [str(missing)]},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_multi_experiment_rejects_duplicates(client: AsyncClient):
    headers = await _headers(client)
    eid = uuid.uuid4()
    response = await client.post(
        "/api/analytics/multi-experiment",
        headers=headers,
        json={"experiment_ids": [str(eid), str(eid)]},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_statistical_tests_same_algorithm_rejected(client: AsyncClient):
    headers = await _headers(client)
    response = await client.get(
        "/api/analytics/statistical-tests?algorithm_a=sobel&algorithm_b=sobel",
        headers=headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_comparison_charts_same_experiment_rejected(client: AsyncClient):
    headers = await _headers(client)
    eid = uuid.uuid4()
    response = await client.get(
        f"/api/comparison/experiments/charts?experiment_a={eid}&experiment_b={eid}",
        headers=headers,
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_benchmark_progress_not_found(client: AsyncClient):
    headers = await _headers(client)
    response = await client.get(
        f"/api/benchmarks/{uuid.uuid4()}/runs/{uuid.uuid4()}/progress",
        headers=headers,
    )
    assert response.status_code == 404
