"""Comparison center sprint: multi-experiment, benchmark summary, dataset ranking, leaderboard splits."""

import uuid

import pytest
from httpx import AsyncClient


async def _auth_headers(client: AsyncClient) -> dict[str, str]:
    reg = await client.post(
        "/api/auth/register",
        json={"email": f"sprint-{uuid.uuid4().hex[:8]}@example.com", "password": "securepass123"},
    )
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_multi_experiments_empty_ids(client: AsyncClient):
    headers = await _auth_headers(client)
    response = await client.get("/api/comparison/multi-experiments?ids=", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "empty"
    assert body["table"] == []


@pytest.mark.asyncio
async def test_multi_experiments_unknown_ids_no_500(client: AsyncClient):
    headers = await _auth_headers(client)
    unknown = uuid.uuid4()
    response = await client.get(
        f"/api/comparison/multi-experiments?ids={unknown}",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "empty"
    assert body["included_count"] == 0


@pytest.mark.asyncio
async def test_benchmark_summary_no_run_empty_state(client: AsyncClient):
    headers = await _auth_headers(client)
    bench = await client.post(
        "/api/benchmarks",
        headers=headers,
        json={
            "slug": f"sprint-{uuid.uuid4().hex[:6]}",
            "name": "Sprint bench",
        },
    )
    assert bench.status_code == 201, bench.text

    benchmark_id = bench.json()["id"]
    response = await client.get(
        f"/api/comparison/benchmark-summary/{benchmark_id}",
        headers=headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "no_run"
    assert body["table"] == []
    assert "Run Benchmark" in body["message"] or "ishga tushirilmagan" in body["message"]


@pytest.mark.asyncio
async def test_global_dataset_ranking_empty(client: AsyncClient):
    headers = await _auth_headers(client)
    response = await client.get("/api/comparison/dataset-ranking", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "empty"
    assert body["run_count"] == 0
    assert body["table"] == []


@pytest.mark.asyncio
async def test_leaderboard_split_endpoints(client: AsyncClient):
    headers = await _auth_headers(client)
    for path in (
        "/api/leaderboard/algorithms",
        "/api/leaderboard/benchmarks",
        "/api/leaderboard/datasets",
    ):
        response = await client.get(path, headers=headers)
        assert response.status_code == 200
        assert "items" in response.json()


@pytest.mark.asyncio
async def test_benchmark_run_summary_not_found(client: AsyncClient):
    headers = await _auth_headers(client)
    response = await client.get(
        f"/api/benchmarks/{uuid.uuid4()}/runs/{uuid.uuid4()}/summary",
        headers=headers,
    )
    assert response.status_code == 404
