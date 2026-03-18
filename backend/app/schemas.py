from datetime import datetime

from pydantic import BaseModel


class UploadAccepted(BaseModel):
    upload_id: str
    note_id: str
    status: str


class TranscriptRead(BaseModel):
    id: str
    text: str
    language_code: str
    provider: str
    segments: list[dict]
    created_at: datetime
    updated_at: datetime


class FolderRead(BaseModel):
    id: str
    title: str
    description: str | None
    note_count: int
    created_at: datetime
    updated_at: datetime


class NoteRead(BaseModel):
    id: str
    user_id: str
    folder_id: str | None
    folder_title: str | None
    audio_upload_id: str | None
    processing_status: str
    title: str
    summary: str | None
    cleaned_content: str | None
    raw_transcript: str | None
    key_terms: list[str]
    review_questions: list[str]
    suggested_folder: str | None
    tags: list[str]
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    transcript: TranscriptRead | None


class NoteListItem(BaseModel):
    id: str
    title: str
    summary: str | None
    processing_status: str
    folder_title: str | None
    tags: list[str]
    updated_at: datetime
