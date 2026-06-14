"""PDF image embedding must accept BytesIO, not ImageReader."""

import io

import pytest
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image as RLImage, SimpleDocTemplate

from app.config import Settings
from app.services.report_service import ReportService


def _minimal_png() -> bytes:
    img = PILImage.new("RGB", (8, 8), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_rl_image_from_bytes_builds_pdf_without_type_error():
    settings = Settings(
        database_url="postgresql://user:pass@localhost/db",
        secret_key="test-secret-key-32chars-minimum!!",
        jwt_secret="test-jwt-secret-32chars-minimum!!!",
        storage_backend="local",
        api_debug=True,
    )
    service = ReportService(db=None, settings=settings)  # type: ignore[arg-type]
    image = service._rl_image_from_bytes(_minimal_png(), width=50, height=50)
    assert image is not None

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    doc.build([image])
    assert buffer.getvalue().startswith(b"%PDF")


def test_image_reader_is_rejected_by_platypus_image():
    class FakeReader:
        pass

    with pytest.raises(TypeError):
        RLImage(FakeReader(), width=50, height=50)  # type: ignore[arg-type]
