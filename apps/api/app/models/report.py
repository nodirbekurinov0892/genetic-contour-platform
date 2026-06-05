import uuid

from datetime import datetime



from sqlalchemy import DateTime, ForeignKey, String, func

from sqlalchemy.dialects.postgresql import UUID

from sqlalchemy.orm import Mapped, mapped_column, relationship



from app.database import Base





class Report(Base):

    __tablename__ = "reports"



    id: Mapped[uuid.UUID] = mapped_column(

        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4

    )

    experiment_id: Mapped[uuid.UUID] = mapped_column(

        UUID(as_uuid=True),

        ForeignKey("experiments.id", ondelete="CASCADE"),

        nullable=False,

    )

    user_id: Mapped[uuid.UUID] = mapped_column(

        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False

    )

    format: Mapped[str] = mapped_column(String(16), nullable=False)

    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    public_url: Mapped[str] = mapped_column(String(2048), nullable=False)

    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(

        DateTime(timezone=True), server_default=func.now()

    )



    user: Mapped["User"] = relationship(back_populates="reports")  # noqa: F821


