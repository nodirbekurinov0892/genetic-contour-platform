import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GAGenerationHistory(Base):
    __tablename__ = "ga_generation_history"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    algorithm_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("algorithm_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    generation: Mapped[int] = mapped_column(Integer, nullable=False)
    best_fitness: Mapped[float] = mapped_column(Float, nullable=False)
    average_fitness: Mapped[float] = mapped_column(Float, nullable=False)
    mutation_rate: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    algorithm_run: Mapped["AlgorithmRun"] = relationship(  # noqa: F821
        back_populates="generation_history"
    )
