from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class Note(Base):
    __tablename__ = "app_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    study_session_id: Mapped[str] = mapped_column(
        ForeignKey("app_study_sessions.id"),
        unique=True,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[str] = mapped_column(Text)
    content: Mapped[str] = mapped_column(Text)
    note_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    study_session: Mapped["StudySession"] = relationship(
        back_populates="note",
        foreign_keys=[study_session_id],
    )
    user: Mapped["User"] = relationship(back_populates="notes")
    flashcards: Mapped[list["Flashcard"]] = relationship(back_populates="note")
