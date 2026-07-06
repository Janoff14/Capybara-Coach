from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.practice_attempt import PracticeAttempt
from app.models.review_schedule import ReviewSchedule
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.review import (
    PracticeAttemptInput,
    PracticeAttemptRead,
    ReviewGradeInput,
    ReviewScheduleRead,
)
from app.services.ai import assess_flashcard_practice
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

    _apply_review_rating(schedule, rating)

    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return _serialize_review_schedule(schedule)


@router.post("/{session_id}/attempts", response_model=PracticeAttemptRead)
def assess_practice_attempt(
    session_id: str,
    payload: PracticeAttemptInput,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> PracticeAttemptRead:
    study_session = db.scalars(
        select(StudySession)
        .options(
            joinedload(StudySession.document),
            joinedload(StudySession.flashcards),
            joinedload(StudySession.review_schedule),
        )
        .where(
            StudySession.id == session_id,
            StudySession.user_id == current_user.id,
        )
    ).unique().one_or_none()
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")

    cards = sorted(study_session.flashcards, key=lambda card: card.order_index)
    if not cards:
        raise HTTPException(status_code=400, detail="Generate flashcards before starting practice.")

    answer_ids = [answer.flashcard_id for answer in payload.answers]
    if len(answer_ids) != len(set(answer_ids)):
        raise HTTPException(status_code=400, detail="Each flashcard can only be answered once.")
    if any(not answer.answer.strip() for answer in payload.answers):
        raise HTTPException(status_code=400, detail="Written answers cannot be blank.")
    card_ids = {card.id for card in cards}
    if set(answer_ids) != card_ids:
        raise HTTPException(status_code=400, detail="Answer every card in this deck before assessment.")

    answer_map = {answer.flashcard_id: answer for answer in payload.answers}
    card_payload = [
        {"id": card.id, "question": card.question, "answer": card.answer}
        for card in cards
    ]
    assessment_answers = [
        {
            "flashcard_id": card.id,
            "question": card.question,
            "expected_answer": card.answer,
            "user_answer": answer_map[card.id].answer.strip(),
            "elapsed_seconds": answer_map[card.id].elapsed_seconds,
        }
        for card in cards
    ]
    assessment = assess_flashcard_practice(
        cards=card_payload,
        answers=assessment_answers,
        active_seconds=payload.active_seconds,
        paused_seconds=payload.paused_seconds,
        settings=settings,
    )
    rating = str(assessment.get("rating") or "hard").lower()
    if rating not in {"hard", "medium", "easy"}:
        rating = "hard"

    schedule = study_session.review_schedule
    if schedule is None:
        schedule = ReviewSchedule(
            user_id=current_user.id,
            study_session_id=study_session.id,
            interval_index=0,
            current_interval_days=1,
            completed_reviews=0,
            next_review_at=utcnow(),
        )
        study_session.review_schedule = schedule
    _apply_review_rating(schedule, rating)

    attempt = PracticeAttempt(
        user_id=current_user.id,
        study_session_id=study_session.id,
        active_seconds=payload.active_seconds,
        paused_seconds=payload.paused_seconds,
        rating=rating,
        score=int(assessment.get("score") or 0),
        answers_json=[answer.model_dump() for answer in payload.answers],
        assessment_json=assessment,
    )
    db.add_all([schedule, attempt])
    db.commit()
    db.refresh(attempt)

    return PracticeAttemptRead.model_validate(
        {
            "id": attempt.id,
            "study_session_id": study_session.id,
            "active_seconds": attempt.active_seconds,
            "paused_seconds": attempt.paused_seconds,
            "rating": attempt.rating,
            "score": attempt.score,
            "assessment": attempt.assessment_json,
            "schedule": _serialize_review_schedule(schedule),
            "created_at": _ensure_utc_datetime(attempt.created_at),
        }
    )


def _apply_review_rating(schedule: ReviewSchedule, rating: str) -> None:
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
