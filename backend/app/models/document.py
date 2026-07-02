from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class Document(Base):
    __tablename__ = "app_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="pdf")
    storage_bucket: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(500), unique=True)
    extracted_text: Mapped[str] = mapped_column(Text)
    reader_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped["User"] = relationship(back_populates="documents")
    study_sessions: Mapped[list["StudySession"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )
    reading_progress: Mapped["DocumentProgress | None"] = relationship(
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )

    @property
    def last_read_page(self) -> int:
        return self.reading_progress.last_read_page if self.reading_progress else 0

    @property
    def progress_percent(self) -> int:
        if self.page_count <= 0 or self.last_read_page <= 0:
            return 0
        return min(100, round((self.last_read_page / self.page_count) * 100))
