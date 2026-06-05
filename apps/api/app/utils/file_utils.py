import re
import uuid
from pathlib import Path

try:
    import magic
except ImportError:
    magic = None  # type: ignore[assignment]

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def sanitize_filename(filename: str) -> str:
    """Remove path components and unsafe characters from filename."""
    name = Path(filename).name
    name = re.sub(r"[^\w.\-]", "_", name)
    return name[:200] if name else "upload"


def generate_safe_filename(original_name: str) -> str:
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".png"
    return f"{uuid.uuid4().hex}{ext}"


def validate_extension(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


def detect_mime_type(file_bytes: bytes, filename: str = "") -> str:
    if magic is not None:
        try:
            return magic.from_buffer(file_bytes, mime=True)
        except Exception:
            pass
    ext = Path(filename).suffix.lower()
    return MIME_BY_EXT.get(ext, "application/octet-stream")


def ensure_path_within_base(file_path: Path, base_dir: Path) -> Path:
    """Prevent path traversal attacks."""
    resolved = file_path.resolve()
    base = base_dir.resolve()
    if not str(resolved).startswith(str(base)):
        raise ValueError("Path traversal detected")
    return resolved
