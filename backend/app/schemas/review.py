from datetime import datetime

from pydantic import BaseModel


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
