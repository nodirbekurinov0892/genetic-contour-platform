"""Supabase Storage backend (public bucket, service-role API access)."""

from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import quote

import httpx

from app.config import Settings
from app.services.storage.base import StorageBackend, StoredObject
from app.services.storage.exceptions import StorageObjectNotFoundError

logger = logging.getLogger(__name__)

_LIST_PAGE_SIZE = 1000


class SupabaseStorageBackend(StorageBackend):
    def __init__(self, settings: Settings):
        self.settings = settings
        self.bucket = settings.supabase_storage_bucket.strip()
        self.base_url = settings.supabase_url.rstrip("/")
        self.service_key = settings.supabase_service_role_key.strip()
        self.public_base = settings.resolved_supabase_public_base_url
        self._timeout = httpx.Timeout(30.0, connect=10.0)

    def _normalize_key(self, storage_key: str) -> str:
        return storage_key.replace("\\", "/").lstrip("/")

    def _auth_headers(self, content_type: str | None = None) -> dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.service_key}",
            "apikey": self.service_key,
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def _object_url(self, storage_key: str, *, public: bool = False) -> str:
        key = quote(self._normalize_key(storage_key), safe="/")
        if public:
            return f"{self.base_url}/storage/v1/object/public/{self.bucket}/{key}"
        return f"{self.base_url}/storage/v1/object/{self.bucket}/{key}"

    def _raise_for_status(self, response: httpx.Response, storage_key: str) -> None:
        if response.status_code == 404:
            raise StorageObjectNotFoundError(storage_key)
        if response.status_code >= 400:
            detail = response.text[:500]
            raise OSError(
                f"Supabase storage error {response.status_code} for {storage_key}: {detail}"
            )

    def save_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str | None = None,
    ) -> StoredObject:
        key = self._normalize_key(storage_key)
        url = self._object_url(key)
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                url,
                content=data,
                headers=self._auth_headers(content_type or "application/octet-stream"),
                params={"upsert": "true"},
            )
        self._raise_for_status(response, key)
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
        data = Path(source_path).read_bytes()
        return self.save_bytes(storage_key, data, content_type)

    def get_bytes(self, storage_key: str) -> bytes:
        key = self._normalize_key(storage_key)
        url = self._object_url(key)
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(url, headers=self._auth_headers())
        self._raise_for_status(response, key)
        return response.content

    def delete_file(self, storage_key: str) -> bool:
        key = self._normalize_key(storage_key)
        url = self._object_url(key)
        with httpx.Client(timeout=self._timeout) as client:
            response = client.delete(url, headers=self._auth_headers())
        if response.status_code == 404:
            return False
        self._raise_for_status(response, key)
        return True

    def delete_prefix(self, prefix: str) -> int:
        normalized = self._normalize_key(prefix).rstrip("/") + "/"
        keys_before = self.list_prefix(normalized)
        if not keys_before:
            return 0
        url = f"{self.base_url}/storage/v1/object/{self.bucket}"
        with httpx.Client(timeout=self._timeout) as client:
            response = client.request(
                "DELETE",
                url,
                headers={**self._auth_headers(), "Content-Type": "application/json"},
                json={"prefixes": [normalized]},
            )
        if response.status_code >= 400:
            logger.warning(
                "Supabase prefix delete failed for %s: %s — falling back to per-object delete",
                normalized,
                response.text[:200],
            )
            removed = 0
            for key in keys_before:
                if self.delete_file(key):
                    removed += 1
            return removed
        return len(keys_before)

    def list_prefix(self, prefix: str) -> list[str]:
        normalized = self._normalize_key(prefix).rstrip("/")
        folder_prefix = f"{normalized}/" if normalized else ""
        return self._list_files_recursive(folder_prefix)

    def _list_files_recursive(self, folder_prefix: str) -> list[str]:
        collected: list[str] = []
        for item in self._list_objects_page(folder_prefix, offset=0):
            name = item.get("name")
            if not name:
                continue
            child_prefix = f"{folder_prefix}{name}"
            metadata = item.get("metadata")
            if metadata is not None:
                collected.append(child_prefix.rstrip("/"))
                continue
            collected.extend(self._list_files_recursive(f"{child_prefix}/"))
        return collected

    def _list_objects_page(self, folder_prefix: str, offset: int) -> list[dict]:
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self.base_url}/storage/v1/object/list/{self.bucket}",
                headers={**self._auth_headers(), "Content-Type": "application/json"},
                json={
                    "prefix": folder_prefix,
                    "limit": _LIST_PAGE_SIZE,
                    "offset": offset,
                },
            )
        if response.status_code == 404:
            return []
        self._raise_for_status(response, folder_prefix)
        items = response.json()
        return items if isinstance(items, list) else []

    def exists(self, storage_key: str) -> bool:
        key = self._normalize_key(storage_key)
        parent = str(Path(key).parent).replace("\\", "/")
        search_prefix = f"{parent}/" if parent and parent != "." else ""
        target_name = Path(key).name

        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                f"{self.base_url}/storage/v1/object/list/{self.bucket}",
                headers={**self._auth_headers(), "Content-Type": "application/json"},
                json={"prefix": search_prefix, "search": target_name, "limit": 100},
            )
        if response.status_code == 404:
            return False
        if response.status_code >= 400:
            return False
        items = response.json()
        if not isinstance(items, list):
            return False
        for item in items:
            name = item.get("name", "")
            full_key = f"{search_prefix}{name}" if search_prefix else name
            if full_key == key or name == target_name:
                return True
        return False

    def get_public_url(self, storage_key: str) -> str:
        key = self._normalize_key(storage_key)
        return f"{self.public_base}/{quote(key, safe='/')}"

    def get_signed_url(self, storage_key: str, expires_in: int = 3600) -> str:
        key = self._normalize_key(storage_key)
        encoded = quote(key, safe="/")
        url = f"{self.base_url}/storage/v1/object/sign/{self.bucket}/{encoded}"
        with httpx.Client(timeout=self._timeout) as client:
            response = client.post(
                url,
                headers={**self._auth_headers(), "Content-Type": "application/json"},
                json={"expiresIn": expires_in},
            )
        self._raise_for_status(response, key)
        payload = response.json()
        signed = payload.get("signedURL") or payload.get("signedUrl")
        if not signed:
            return self.get_public_url(key)
        if signed.startswith("http"):
            return signed
        return f"{self.base_url}{signed}"
