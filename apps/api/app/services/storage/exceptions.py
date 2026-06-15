"""Storage layer exceptions."""


class StorageObjectNotFoundError(FileNotFoundError):
    """Raised when a storage object key is valid but the blob is missing."""

    def __init__(self, storage_key: str):
        self.storage_key = storage_key
        super().__init__(f"Storage object not found: {storage_key}")
