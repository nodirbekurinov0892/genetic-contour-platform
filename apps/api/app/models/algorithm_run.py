import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlgorithmRun(Base):
    __tablename__ = "algorithm_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    experiment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("experiments.id", ondelete="CASCADE"),
        nullable=False,
    )
    algorithm_name: Mapped[str] = mapped_column(String(64), nullable=False)
    parameters_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    runtime_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    experiment: Mapped["Experiment"] = relationship(back_populates="algorithm_runs")  # noqa: F821
    ga_parameters: Mapped["GAParameters | None"] = relationship(  # noqa: F821
        back_populates="algorithm_run", uselist=False, cascade="all, delete-orphan"
    )
    generation_history: Mapped[list["GAGenerationHistory"]] = relationship(  # noqa: F821
        back_populates="algorithm_run", lazy="selectin", cascade="all, delete-orphan"
    )
    result_images: Mapped[list["ResultImage"]] = relationship(  # noqa: F821
        back_populates="algorithm_run", lazy="selectin", cascade="all, delete-orphan"
    )
    metrics: Mapped[list["Metric"]] = relationship(  # noqa: F821
        back_populates="algorithm_run", lazy="selectin", cascade="all, delete-orphan"
    )
