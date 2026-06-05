from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GAParamsSchema(BaseModel):
    population_size: int = Field(default=50, ge=10, le=500)
    generations: int = Field(default=30, ge=5, le=200)
    mutation_rate: float = Field(default=0.05, ge=0.0, le=1.0)
    crossover_rate: float = Field(default=0.7, ge=0.0, le=1.0)
    elitism_count: int = Field(default=2, ge=0, le=20)
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    blur_kernel: int = Field(default=5, ge=1, le=15)
    resize_width: int = Field(default=256, ge=64, le=1024)


class AlgorithmParamsSchema(BaseModel):
    threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    blur_kernel: int = Field(default=5, ge=1, le=15)
    resize_width: int = Field(default=256, ge=64, le=1024)
    canny_low: float = Field(default=50.0, ge=0.0, le=255.0)
    canny_high: float = Field(default=150.0, ge=0.0, le=255.0)


class ExperimentCreate(BaseModel):
    image_id: UUID
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None


class ExperimentRunRequest(BaseModel):
    algorithm: str = Field(
        description="sobel | prewitt | canny | genetic | compare_all"
    )
    params: AlgorithmParamsSchema = Field(default_factory=AlgorithmParamsSchema)
    ga_params: GAParamsSchema | None = None


class MetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    edge_density: float | None
    continuity_score: float | None
    noise_score: float | None
    fitness_score: float | None
    runtime_ms: int | None


class ResultImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    storage_key: str
    public_url: str | None = None
    file_path: str | None = None
    url: str | None = None


class GenerationHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    generation: int
    best_fitness: float
    average_fitness: float
    mutation_rate: float


class AlgorithmRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    algorithm_name: str
    parameters_json: dict[str, Any] | None
    result_json: dict[str, Any] | None
    runtime_ms: int | None
    status: str
    metrics: list[MetricResponse] = []
    result_images: list[ResultImageResponse] = []
    generation_history: list[GenerationHistoryResponse] = []


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_id: UUID
    title: str
    description: str | None
    status: str
    progress_percent: float = 0.0
    current_generation: int | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None


class ExperimentJobResponse(BaseModel):
    job_id: UUID
    status: str


class ExperimentStatusResponse(BaseModel):
    job_id: UUID
    status: str
    progress_percent: float
    current_generation: int | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    error_message: str | None = None


class ExperimentResultsResponse(BaseModel):
    experiment: ExperimentResponse
    algorithm_runs: list[AlgorithmRunResponse]
