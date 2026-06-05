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

from app.utils.file_utils import detect_mime_type, generate_safe_filename, validate_extension

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



    async def list_all(self, user: User, limit: int = 50, offset: int = 0) -> list[Image]:

        result = await self.db.execute(

            select(Image)

            .where(Image.user_id == user.id)

            .order_by(Image.created_at.desc())

            .limit(limit)

            .offset(offset)

        )

        return list(result.scalars().all())



    def get_image_bytes(self, image: Image) -> bytes:

        key = self.storage.resolve_storage_key(

            storage_key=image.storage_key,

            file_path=image.file_path,

        )

        return self.storage.get_bytes(key)


