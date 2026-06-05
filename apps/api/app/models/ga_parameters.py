import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GAParameters(Base):
    __tablename__ = "ga_parameters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    algorithm_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("algorithm_runs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    population_size: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    generations: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    mutation_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.05)
    crossover_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    elitism_count: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    threshold: Mapped[float] = mapped_column(Float, nullable=False, default=0.5)
    blur_kernel: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    resize_width: Mapped[int] = mapped_column(Integer, nullable=False, default=256)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    algorithm_run: Mapped["AlgorithmRun"] = relationship(back_populates="ga_parameters")  # noqa: F821
