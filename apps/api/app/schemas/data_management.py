from uuid import UUID

from pydantic import BaseModel, Field


class ExperimentUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None


class ImageUpdateRequest(BaseModel):
    original_name: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None


class BenchmarkUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=512)
    description: str | None = None
    category: str | None = None


class ReportUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=512)


class BulkExperimentRequest(BaseModel):
    experiment_ids: list[UUID] = Field(min_length=1, max_length=100)
    permanent: bool = False


class BulkImageRequest(BaseModel):
    image_ids: list[UUID] = Field(min_length=1, max_length=100)
    cascade_experiments: bool = False
    permanent: bool = False


class BulkReportRequest(BaseModel):
    report_ids: list[UUID] = Field(min_length=1, max_length=100)
