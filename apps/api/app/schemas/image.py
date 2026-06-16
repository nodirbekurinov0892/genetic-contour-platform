from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ImageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    original_name: str
    storage_key: str
    public_url: str | None = None
    file_path: str | None = None
    url: str | None = None
    width: int
    height: int
    size: int
    mime_type: str
    has_ground_truth: bool = False
    ground_truth_storage_key: str | None = None
    storage_status: str = "unknown"
    ground_truth_storage_status: str = "not_paired"
    ground_truth_url: str | None = None
    ground_truth_uploaded_at: datetime | None = None
    content_checksum: str | None = None
    gt_checksum: str | None = None
    gt_validation_status: str | None = None
    gt_display_status: str | None = None
    gt_validation_metadata: dict | None = None
    gt_provenance_json: dict | None = None
    gt_validated_at: datetime | None = None
    dataset_version: str | None = None
    created_at: datetime


class ImageUploadResponse(BaseModel):
    image: ImageResponse
    message: str = "Image uploaded successfully"
