from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

from .shared import generate_uuid, utcnow


class ReviewSchedule(Base):
    __tablename__ = "app_review_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_users.id"), index=True)
    study_session_id: Mapped[str] = mapped_column(
        ForeignKey("app_study_sessions.id"),
        unique=True,
        index=True,
    )
    interval_index: Mapped[int] = mapped_column(Integer, default=0)
    current_interval_days: Mapped[int] = mapped_column(Integer, default=1)
    completed_reviews: Mapped[int] = mapped_column(Integer, default=0)
    last_rating: Mapped[str | None] = mapped_column(String(16), nullable=True)
    last_reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )

    user: Mapped["User"] = relationship(back_populates="review_schedules")
    study_session: Mapped["StudySession"] = relationship(back_populates="review_schedule")
