import uuid

from datetime import datetime



from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func

from sqlalchemy.dialects.postgresql import JSONB, UUID

from sqlalchemy.orm import Mapped, mapped_column, relationship



from app.database import Base





class Image(Base):

    __tablename__ = "images"



    id: Mapped[uuid.UUID] = mapped_column(

        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4

    )

    user_id: Mapped[uuid.UUID] = mapped_column(

        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False

    )

    original_name: Mapped[str] = mapped_column(String(512), nullable=False)

    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    public_url: Mapped[str] = mapped_column(String(2048), nullable=False)

    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    width: Mapped[int] = mapped_column(Integer, nullable=False)

    height: Mapped[int] = mapped_column(Integer, nullable=False)

    size: Mapped[int] = mapped_column(Integer, nullable=False)

    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)

    ground_truth_storage_key: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    ground_truth_public_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    ground_truth_file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    ground_truth_uploaded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dataset_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    content_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gt_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)
    gt_validation_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    gt_validation_metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    gt_provenance_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    gt_validated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(

        DateTime(timezone=True), server_default=func.now()

    )



    user: Mapped["User"] = relationship(back_populates="images")  # noqa: F821

    experiments: Mapped[list["Experiment"]] = relationship(  # noqa: F821

        back_populates="image", lazy="selectin"

    )


