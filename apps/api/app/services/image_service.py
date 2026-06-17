import logging

import uuid



import cv2

import numpy as np

from fastapi import HTTPException, UploadFile

from sqlalchemy import select

from sqlalchemy.ext.asyncio import AsyncSession



from app.config import Settings

from app.models.image import Image

from app.models.user import User

from app.services.storage import StorageService

from app.services.gt_validation import (
    build_gt_provenance,
    decode_gt_from_bytes,
    sha256_hex,
    validate_ground_truth_mask,
)

from app.utils.file_utils import detect_mime_type, validate_extension
from app.utils.ownership import ensure_owner



logger = logging.getLogger(__name__)





class ImageService:

    def __init__(self, db: AsyncSession, settings: Settings, storage: StorageService | None = None):

        self.db = db

        self.settings = settings

        self.storage = storage or StorageService(settings)



    async def upload(self, file: UploadFile, user: User) -> Image:

        if not file.filename or not validate_extension(file.filename):

            raise HTTPException(

                status_code=400,

                detail="Invalid file extension. Allowed: JPG, PNG, WebP",

            )



        content = await file.read()

        if len(content) > self.settings.max_upload_bytes:

            raise HTTPException(

                status_code=413,

                detail=f"File too large. Max {self.settings.max_upload_size_mb}MB",

            )



        mime = detect_mime_type(content, file.filename or "")

        if mime not in self.settings.allowed_mime_list:

            raise HTTPException(

                status_code=400,

                detail=f"Invalid MIME type: {mime}",

            )



        ext = "." + (file.filename.rsplit(".", 1)[-1].lower() if file.filename else "png")

        storage_key = self.storage.upload_key(ext)

        stored = self.storage.save_bytes(storage_key, content, mime)



        arr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)

        if arr is None:

            self.storage.delete_file(storage_key)

            raise HTTPException(status_code=400, detail="Unable to decode image")



        height, width = arr.shape[:2]



        image = Image(
            id=uuid.uuid4(),
            user_id=user.id,
            original_name=file.filename,
            storage_key=stored.storage_key,
            public_url=stored.public_url,
            file_path=stored.storage_key,
            width=width,
            height=height,
            size=len(content),
            mime_type=mime,
            content_checksum=sha256_hex(content),
            dataset_version="1.0",
        )

        self.db.add(image)

        await self.db.flush()

        logger.info("Uploaded image %s (%dx%d) -> %s", image.id, width, height, stored.storage_key)

        return image



    async def get_by_id(self, image_id: uuid.UUID, user: User) -> Image:

        result = await self.db.execute(select(Image).where(Image.id == image_id))

        image = result.scalar_one_or_none()

        if not image:

            raise HTTPException(status_code=404, detail="Image not found")

        ensure_owner(image.user_id, user.id, "image")

        return image



    async def list_all(
        self,
        user: User,
        limit: int = 50,
        offset: int = 0,
        search: str | None = None,
        has_ground_truth: bool | None = None,
    ) -> list[Image]:
        query = select(Image).where(
            Image.user_id == user.id,
            Image.deleted_at.is_(None),
        )
        if search and search.strip():
            query = query.where(Image.original_name.ilike(f"%{search.strip()}%"))
        if has_ground_truth is True:
            query = query.where(Image.ground_truth_storage_key.isnot(None))
        elif has_ground_truth is False:
            query = query.where(Image.ground_truth_storage_key.is_(None))
        result = await self.db.execute(
            query.order_by(Image.created_at.desc()).limit(limit).offset(offset)
        )
        return list(result.scalars().all())

    async def upload_ground_truth(
        self,
        image_id: uuid.UUID,
        file: UploadFile,
        user: User,
    ) -> Image:
        from datetime import datetime, timezone

        image = await self.get_by_id(image_id, user)
        if not file.filename or not validate_extension(file.filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid file extension. Allowed: JPG, PNG, WebP",
            )

        content = await file.read()
        if len(content) > self.settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max {self.settings.max_upload_size_mb}MB",
            )

        mime = detect_mime_type(content, file.filename or "")
        if mime not in self.settings.allowed_mime_list:
            raise HTTPException(status_code=400, detail=f"Invalid MIME type: {mime}")

        arr = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_GRAYSCALE)
        if arr is None:
            raise HTTPException(status_code=400, detail="Unable to decode ground truth mask")

        validation = validate_ground_truth_mask(arr, image.width, image.height)
        checksum = sha256_hex(content)

        storage_key = self.storage.ground_truth_key(str(image_id))
        stored = self.storage.save_bytes(storage_key, content, mime)

        if image.ground_truth_storage_key:
            self.storage.delete_file(image.ground_truth_storage_key)

        image.ground_truth_storage_key = stored.storage_key
        image.ground_truth_public_url = stored.public_url
        image.ground_truth_file_path = stored.storage_key
        image.ground_truth_uploaded_at = datetime.now(timezone.utc)
        image.gt_checksum = checksum
        image.gt_validation_status = validation["status"]
        image.gt_validation_metadata = validation
        image.gt_validated_at = datetime.now(timezone.utc)
        image.gt_provenance_json = build_gt_provenance(
            uploaded_by_user_id=str(user.id),
            original_filename=file.filename,
            source_image_id=str(image.id),
            checksum=checksum,
            validation=validation,
        )
        await self.db.flush()
        logger.info("Ground truth uploaded for image %s -> %s", image.id, stored.storage_key)
        return image

    async def revalidate_ground_truth(self, image_id: uuid.UUID, user: User) -> Image:
        from datetime import datetime, timezone

        image = await self.get_by_id(image_id, user)
        if not image.ground_truth_storage_key:
            raise HTTPException(status_code=404, detail="No ground truth to validate")

        key = self.storage.resolve_storage_key(
            storage_key=image.ground_truth_storage_key,
            file_path=image.ground_truth_file_path,
        )
        content = self.storage.get_bytes(key)
        arr = decode_gt_from_bytes(content)
        if arr is None:
            image.gt_validation_status = "invalid"
            image.gt_validation_metadata = {"status": "invalid", "issues": ["Decode failed"]}
        else:
            validation = validate_ground_truth_mask(arr, image.width, image.height)
            image.gt_validation_status = validation["status"]
            image.gt_validation_metadata = validation
            image.gt_checksum = sha256_hex(content)
        image.gt_validated_at = datetime.now(timezone.utc)
        if image.gt_provenance_json:
            image.gt_provenance_json = {
                **image.gt_provenance_json,
                "revalidated_at": image.gt_validated_at.isoformat(),
                "validation_status": image.gt_validation_status,
            }
        await self.db.flush()
        return image

    async def list_gt_manager(
        self,
        user: User,
        *,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Image]:
        query = select(Image).where(
            Image.user_id == user.id,
            Image.ground_truth_storage_key.isnot(None),
        )
        if status:
            query = query.where(Image.gt_validation_status == status)
        result = await self.db.execute(
            query.order_by(Image.gt_validated_at.desc().nullslast()).limit(limit).offset(offset)
        )
        return list(result.scalars().all())



    def get_image_bytes(self, image: Image) -> bytes:

        key = self.storage.resolve_storage_key(

            storage_key=image.storage_key,

            file_path=image.file_path,

        )

        return self.storage.get_bytes(key)


