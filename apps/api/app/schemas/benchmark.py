from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BenchmarkCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=128)
    name: str = Field(min_length=1, max_length=512)
    description: str | None = None
    image_ids: list[UUID] | None = None


class BenchmarkDatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_id: UUID
    sort_order: int
    created_at: datetime


class BenchmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    name: str
    description: str | None
    methodology_version: str
    comparison_protocol: str
    is_public: bool
    created_at: datetime
    dataset_count: int = 0
    datasets: list[BenchmarkDatasetResponse] = []


class BenchmarkRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    benchmark_id: UUID
    status: str
    cohort_size: int
    completed_count: int
    aggregate_metrics_json: dict | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    created_at: datetime


class LeaderboardEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    algorithm_name: str
    rank: int
    avg_iou: float | None
    avg_f1: float | None
    avg_dice: float | None
    avg_runtime_ms: float | None
    sample_count: int
