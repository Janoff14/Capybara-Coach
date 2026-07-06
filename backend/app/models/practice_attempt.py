from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class PracticeAttempt(Base):
    __tablename__ = "app_practice_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    study_session_id: Mapped[str] = mapped_column(
        ForeignKey("app_study_sessions.id"),
        index=True,
    )
    active_seconds: Mapped[int] = mapped_column(Integer, default=0)
    paused_seconds: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[str] = mapped_column(String(16))
    score: Mapped[int] = mapped_column(Integer)
    answers_json: Mapped[list] = mapped_column(JSON)
    assessment_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="practice_attempts")
    study_session: Mapped["StudySession"] = relationship(back_populates="practice_attempts")
