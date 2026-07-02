from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class DocumentProgress(Base):
    __tablename__ = "app_document_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "document_id", name="uq_document_progress_owner_document"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    document_id: Mapped[str] = mapped_column(
        ForeignKey("app_documents.id"),
        unique=True,
        index=True,
    )
    last_read_page: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    document: Mapped["Document"] = relationship(back_populates="reading_progress")
