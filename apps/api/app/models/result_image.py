import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ResultImageType(str, Enum):
    ORIGINAL = "original"
    GRAYSCALE = "grayscale"
    GRADIENT = "gradient"
    SOBEL = "sobel"
    PREWITT = "prewitt"
    CANNY = "canny"
    GA = "ga"
    OVERLAY = "overlay"
    MASK = "mask"


class ResultImage(Base):
    __tablename__ = "result_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    algorithm_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("algorithm_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    public_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    algorithm_run: Mapped["AlgorithmRun"] = relationship(back_populates="result_images")  # noqa: F821
