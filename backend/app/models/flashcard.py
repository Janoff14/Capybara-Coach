from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class Flashcard(Base):
    __tablename__ = "app_flashcards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    study_session_id: Mapped[str] = mapped_column(
        ForeignKey("app_study_sessions.id"),
        index=True,
    )
    note_id: Mapped[str | None] = mapped_column(
        ForeignKey("app_notes.id"),
        nullable=True,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    cue: Mapped[str | None] = mapped_column(Text, nullable=True)
    card_type: Mapped[str] = mapped_column(String(32), default="concept")
    source_focus: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flashcard_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped["User"] = relationship(back_populates="flashcards")
    study_session: Mapped["StudySession"] = relationship(back_populates="flashcards")
    note: Mapped["Note | None"] = relationship(back_populates="flashcards")
