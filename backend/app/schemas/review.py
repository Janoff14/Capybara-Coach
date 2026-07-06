from datetime import datetime

from pydantic import BaseModel, Field


class ReviewScheduleRead(BaseModel):
    id: str
    study_session_id: str
    document_id: str
    document_title: str
    note_id: str | None
    next_review_at: datetime
    last_reviewed_at: datetime | None
    last_rating: str | None
    interval_index: int
    current_interval_days: int
    completed_reviews: int
    is_due: bool
    created_at: datetime
    updated_at: datetime


class ReviewGradeInput(BaseModel):
    rating: str


class PracticeAnswerInput(BaseModel):
    flashcard_id: str
    answer: str = Field(min_length=1, max_length=6000)
    elapsed_seconds: int = Field(default=0, ge=0, le=86400)


class PracticeAttemptInput(BaseModel):
    answers: list[PracticeAnswerInput] = Field(min_length=1, max_length=250)
    active_seconds: int = Field(ge=0, le=86400)
    paused_seconds: int = Field(default=0, ge=0, le=86400)


class PracticeAttemptRead(BaseModel):
    id: str
    study_session_id: str
    active_seconds: int
    paused_seconds: int
    rating: str
    score: int
    assessment: dict
    schedule: ReviewScheduleRead
    created_at: datetime
