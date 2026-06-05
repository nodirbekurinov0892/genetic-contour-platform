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
    created_at: datetime


class ImageUploadResponse(BaseModel):
    image: ImageResponse
    message: str = "Image uploaded successfully"
