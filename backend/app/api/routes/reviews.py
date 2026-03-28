from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.review_schedule import ReviewSchedule
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.review import ReviewGradeInput, ReviewScheduleRead
from app.services.auth import get_current_user
from app.models.shared import utcnow

router = APIRouter(prefix="/reviews", tags=["reviews"])

REVIEW_INTERVALS = [1, 3, 7, 14, 30]


@router.get("", response_model=list[ReviewScheduleRead])
def list_reviews(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ReviewScheduleRead]:
    statement = (
        select(ReviewSchedule)
        .options(joinedload(ReviewSchedule.study_session).joinedload(StudySession.document))
        .where(ReviewSchedule.user_id == current_user.id)
        .order_by(ReviewSchedule.next_review_at.asc())
    )
    schedules = list(db.scalars(statement).unique())
    return [_serialize_review_schedule(schedule) for schedule in schedules]


@router.post("/{session_id}/grade", response_model=ReviewScheduleRead)
def grade_review(
    session_id: str,
    payload: ReviewGradeInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReviewScheduleRead:
    schedule = db.scalars(
        select(ReviewSchedule)
        .options(joinedload(ReviewSchedule.study_session).joinedload(StudySession.document))
        .where(
            ReviewSchedule.study_session_id == session_id,
            ReviewSchedule.user_id == current_user.id,
        )
    ).unique().one_or_none()
    if schedule is None:
        raise HTTPException(status_code=404, detail="Review schedule not found.")

    rating = payload.rating.strip().lower()
    if rating not in {"easy", "medium", "hard"}:
        raise HTTPException(status_code=400, detail="Rating must be easy, medium, or hard.")

    current_index = max(0, min(len(REVIEW_INTERVALS) - 1, schedule.interval_index))
    if rating == "hard":
        next_index = max(0, current_index - 1)
    elif rating == "medium":
        next_index = min(len(REVIEW_INTERVALS) - 1, current_index + 1)
    else:
        next_index = min(len(REVIEW_INTERVALS) - 1, current_index + 2)

    next_interval_days = REVIEW_INTERVALS[next_index]
    reviewed_at = utcnow()

    schedule.interval_index = next_index
    schedule.current_interval_days = next_interval_days
    schedule.completed_reviews += 1
    schedule.last_rating = rating
    schedule.last_reviewed_at = reviewed_at
    schedule.next_review_at = reviewed_at + timedelta(days=next_interval_days)

    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _serialize_review_schedule(schedule)


def _serialize_review_schedule(schedule: ReviewSchedule) -> ReviewScheduleRead:
    next_review_at = _ensure_utc_datetime(schedule.next_review_at)
    last_reviewed_at = _ensure_utc_datetime(schedule.last_reviewed_at)
    created_at = _ensure_utc_datetime(schedule.created_at)
    updated_at = _ensure_utc_datetime(schedule.updated_at)

    return ReviewScheduleRead.model_validate(
        {
            "id": schedule.id,
            "study_session_id": schedule.study_session_id,
            "document_id": schedule.study_session.document_id,
            "document_title": schedule.study_session.document.title,
            "note_id": schedule.study_session.note.id if schedule.study_session.note else None,
            "next_review_at": next_review_at,
            "last_reviewed_at": last_reviewed_at,
            "last_rating": schedule.last_rating,
            "interval_index": schedule.interval_index,
            "current_interval_days": schedule.current_interval_days,
            "completed_reviews": schedule.completed_reviews,
            "is_due": next_review_at <= utcnow(),
            "created_at": created_at,
            "updated_at": updated_at,
        }
    )


def _ensure_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
