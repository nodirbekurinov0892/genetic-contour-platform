"""PDF image embedding must accept BytesIO, not ImageReader."""

import io

import pytest
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Image as RLImage, SimpleDocTemplate

from app.services.report_service import ReportService


_MINIMAL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_rl_image_from_bytes_builds_pdf_without_type_error():
    service = ReportService(db=None, settings=None)  # type: ignore[arg-type]
    image = service._rl_image_from_bytes(_MINIMAL_PNG, width=50, height=50)
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
