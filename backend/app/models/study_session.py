from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class StudySession(Base):
    __tablename__ = "app_study_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("app_documents.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="created")

    audio_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    audio_content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audio_storage_bucket: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audio_storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_provider: Mapped[str | None] = mapped_column(String(100), nullable=True)

    assessment_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assessment_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped["User"] = relationship(back_populates="study_sessions")
    document: Mapped["Document"] = relationship(back_populates="study_sessions")
    note: Mapped["Note | None"] = relationship(
        back_populates="study_session",
        uselist=False,
        cascade="all, delete-orphan",
    )
