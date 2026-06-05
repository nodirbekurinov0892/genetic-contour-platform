"""S3-compatible object storage (AWS S3, Cloudflare R2). Real boto3 implementation."""

import logging

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import Settings
from app.services.storage.base import StorageBackend, StoredObject

logger = logging.getLogger(__name__)


class S3StorageBackend(StorageBackend):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.bucket = settings.s3_bucket_name
        self.public_base = settings.s3_public_base_url.rstrip("/")
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region or None,
            config=Config(signature_version="s3v4"),
        )

    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str | None = None,
    ) -> StoredObject:
        key = self._normalize_key(storage_key)
        extra_args: dict = {}
        if content_type:
            extra_args["ContentType"] = content_type
        self._client.put_object(Bucket=self.bucket, Key=key, Body=data, **extra_args)
        return StoredObject(
            storage_key=key,
            public_url=self.get_public_url(key),
            content_type=content_type,
        )

    def save_file(
        self,
        storage_key: str,
        source_path: str,
        content_type: str | None = None,
    ) -> StoredObject:
        key = self._normalize_key(storage_key)
        extra_args: dict = {}
        if content_type:
            extra_args["ContentType"] = content_type
        self._client.upload_file(source_path, self.bucket, key, ExtraArgs=extra_args or None)
        return StoredObject(
            storage_key=key,
            public_url=self.get_public_url(key),
            content_type=content_type,
        )

    def get_bytes(self, storage_key: str) -> bytes:
        key = self._normalize_key(storage_key)
        response = self._client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def delete_file(self, storage_key: str) -> bool:
        key = self._normalize_key(storage_key)
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            logger.warning("Failed to delete S3 object: %s", key)
            return False

    def delete_prefix(self, prefix: str) -> int:
        normalized = self._normalize_key(prefix).rstrip("/") + "/"
        removed = 0
        paginator = self._client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=normalized):
            contents = page.get("Contents", [])
            if not contents:
                continue
            delete_keys = [{"Key": item["Key"]} for item in contents]
            self._client.delete_objects(
                Bucket=self.bucket,
                Delete={"Objects": delete_keys, "Quiet": True},
            )
            removed += len(delete_keys)
        return removed

    def exists(self, storage_key: str) -> bool:
        key = self._normalize_key(storage_key)
        try:
            self._client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def get_public_url(self, storage_key: str) -> str:
        key = self._normalize_key(storage_key)
        return f"{self.public_base}/{key}"

    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        key = self._normalize_key(storage_key)
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    @staticmethod
    def _normalize_key(storage_key: str) -> str:
        return storage_key.replace("\\", "/").lstrip("/")
