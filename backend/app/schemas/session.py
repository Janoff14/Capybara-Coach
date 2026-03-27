from datetime import datetime

from pydantic import BaseModel, ConfigDict

from .note import NoteRead


class SessionCreate(BaseModel):
    document_id: str


class StudySessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    status: str
    audio_filename: str | None
    audio_content_type: str | None
    audio_storage_bucket: str | None
    audio_storage_path: str | None
    transcript_text: str | None
    transcript_provider: str | None
    assessment_score: int | None
    assessment_feedback: str | None
    assessment_json: dict | None
    note: NoteRead | None
    created_at: datetime
    updated_at: datetime
