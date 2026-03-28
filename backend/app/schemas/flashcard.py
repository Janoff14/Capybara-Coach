from datetime import datetime

from pydantic import BaseModel


class FlashcardRead(BaseModel):
    id: str
    study_session_id: str
    note_id: str | None
    document_id: str
    document_title: str
    order_index: int
    question: str
    answer: str
    cue: str | None
    card_type: str
    source_focus: str | None
    created_at: datetime
    updated_at: datetime
