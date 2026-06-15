from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class BrokenRecord(BaseModel):
    image_id: str | None = None
    original_name: str | None = None
    experiment_id: str | None = None
    run_id: str | None = None
    result_image_id: str | None = None
    issue: str
    storage_key: str
    type: str | None = None


class StorageAuditResponse(BaseModel):
    total_images: int
    missing_originals: int
    missing_ground_truth: int
    missing_results: int
    broken_records: list[BrokenRecord]
    severity: str
    repair_available: bool
    storage_backend: str


class MarkMissingResponse(BaseModel):
    marked_count: int
    marked_records: list[dict[str, str]]
    audit: StorageAuditResponse


class RepairMessageResponse(BaseModel):
    message: str
    image_id: str | None = None
