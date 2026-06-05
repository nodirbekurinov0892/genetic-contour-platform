import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExperimentStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


TERMINAL_STATUSES = frozenset({
    ExperimentStatus.COMPLETED.value,
    ExperimentStatus.FAILED.value,
    ExperimentStatus.CANCELLED.value,
})

ACTIVE_STATUSES = frozenset({
    ExperimentStatus.QUEUED.value,
    ExperimentStatus.RUNNING.value,
})


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ExperimentStatus.PENDING.value
    )
    job_params: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    cancel_requested: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    progress_percent: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    current_generation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    image: Mapped["Image"] = relationship(back_populates="experiments")  # noqa: F821
    user: Mapped["User"] = relationship(back_populates="experiments")  # noqa: F821
    algorithm_runs: Mapped[list["AlgorithmRun"]] = relationship(  # noqa: F821
        back_populates="experiment", lazy="selectin", cascade="all, delete-orphan"
    )
