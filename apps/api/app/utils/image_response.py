"""Shared image API response builder with storage existence checks."""

from app.config import Settings
from app.models.image import Image
from app.schemas.image import ImageResponse
from app.services.storage import StorageService
from app.utils.media_urls import resolve_public_url


def _resolve_key(storage: StorageService, image: Image, *, ground_truth: bool = False) -> str | None:
    if ground_truth:
        if not image.ground_truth_storage_key:
            return None
        return storage.resolve_storage_key(
            storage_key=image.ground_truth_storage_key,
            file_path=image.ground_truth_file_path,
        )
    return storage.resolve_storage_key(
        storage_key=image.storage_key,
        file_path=image.file_path,
    )


def to_image_response(image: Image, settings: Settings) -> ImageResponse:
    storage = StorageService(settings)
    data = ImageResponse.model_validate(image)

    original_key = _resolve_key(storage, image)
    original_exists = storage.exists(original_key) if original_key else False
    data.storage_status = "available" if original_exists else "missing"

    gt_key_ref = image.ground_truth_storage_key
    gt_key = _resolve_key(storage, image, ground_truth=True) if gt_key_ref else None
    gt_file_exists = storage.exists(gt_key) if gt_key else False

    data.ground_truth_storage_key = gt_key_ref

    if not gt_key_ref:
        data.ground_truth_storage_status = "not_paired"
        data.has_ground_truth = False
    elif gt_file_exists:
        data.ground_truth_storage_status = "available"
        data.has_ground_truth = True
        data.ground_truth_url = resolve_public_url(
            storage=storage,
            settings=settings,
            storage_key=image.ground_truth_storage_key,
            public_url=image.ground_truth_public_url,
            file_path=image.ground_truth_file_path,
        )
    else:
        data.ground_truth_storage_status = "reference_missing"
        data.has_ground_truth = False

    if original_exists:
        data.url = resolve_public_url(
            storage=storage,
            settings=settings,
            storage_key=image.storage_key,
            public_url=image.public_url,
            file_path=image.file_path,
        )

    return data
