import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Benchmark(Base):
    __tablename__ = "benchmarks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    methodology_version: Mapped[str] = mapped_column(String(32), nullable=False, default="fair_v1")
    comparison_protocol: Mapped[str] = mapped_column(String(32), nullable=False, default="fair_v1")
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    datasets: Mapped[list["BenchmarkDataset"]] = relationship(
        back_populates="benchmark", lazy="selectin", cascade="all, delete-orphan"
    )
    runs: Mapped[list["BenchmarkRun"]] = relationship(
        back_populates="benchmark", lazy="selectin"
    )


class BenchmarkDataset(Base):
    __tablename__ = "benchmark_datasets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    benchmark_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("benchmarks.id", ondelete="CASCADE"), nullable=False
    )
    image_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("images.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    benchmark: Mapped["Benchmark"] = relationship(back_populates="datasets")
    image: Mapped["Image"] = relationship()  # noqa: F821


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    benchmark_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("benchmarks.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    cohort_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    batch_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    aggregate_metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    report_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    benchmark: Mapped["Benchmark"] = relationship(back_populates="runs")
    leaderboard: Mapped[list["BenchmarkLeaderboard"]] = relationship(
        back_populates="benchmark_run", lazy="selectin", cascade="all, delete-orphan"
    )


class BenchmarkLeaderboard(Base):
    __tablename__ = "benchmark_leaderboard"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    benchmark_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("benchmarks.id", ondelete="CASCADE"), nullable=False
    )
    benchmark_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("benchmark_runs.id", ondelete="CASCADE"), nullable=False
    )
    algorithm_name: Mapped[str] = mapped_column(String(64), nullable=False)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_iou: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_f1: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_dice: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_runtime_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    benchmark_run: Mapped["BenchmarkRun"] = relationship(back_populates="leaderboard")


class StorageOrphan(Base):
    __tablename__ = "storage_orphans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    storage_key: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)
