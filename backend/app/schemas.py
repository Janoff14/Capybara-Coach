from datetime import datetime

from pydantic import BaseModel, Field


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
    user_id: str
    folder_id: str | None
    title: str
    summary: str | None
    processing_status: str
    folder_title: str | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class DocumentSectionRead(BaseModel):
    id: str
    title: str
    page_label: str
    order_index: int
    extracted_text: str
    estimated_read_minutes: int
    difficulty: str
    concept_count: int
    created_at: datetime
    updated_at: datetime


class DocumentRead(BaseModel):
    id: str
    user_id: str
    title: str
    subtitle: str | None
    source_type: str
    original_filename: str | None
    raw_text: str
    section_count: int
    created_at: datetime
    updated_at: datetime
    sections: list[DocumentSectionRead]


class DocumentListItem(BaseModel):
    id: str
    user_id: str
    title: str
    subtitle: str | None
    source_type: str
    section_count: int
    created_at: datetime
    updated_at: datetime


class StudySessionCreateRequest(BaseModel):
    document_id: str
    section_id: str | None = None
    mode: str = "assisted"
    user_id: str | None = None
    email: str | None = None
    display_name: str | None = None


class StudySessionEvaluateRequest(BaseModel):
    recall_transcript: str = Field(min_length=1)
    actual_read_seconds: int | None = Field(default=None, ge=0)


class StudySessionRead(BaseModel):
    id: str
    user_id: str
    document_id: str
    section_id: str
    note_id: str | None
    document_title: str
    section_title: str
    section_page_label: str
    mode: str
    status: str
    actual_read_seconds: int
    attempt_count: int
    threshold_score: int
    passed_threshold: bool
    recall_transcript: str | None
    score_total: int | None
    recall_score: int | None
    accuracy_score: int | None
    detail_score: int | None
    missing_concept_count: int
    misconception_count: int
    strengths: list[str]
    specific_feedback: list[str]
    missing_pieces: list[str]
    misconceptions: list[str]
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class StudySessionListItem(BaseModel):
    id: str
    document_id: str
    section_id: str
    note_id: str | None
    document_title: str
    section_title: str
    mode: str
    status: str
    score_total: int | None
    passed_threshold: bool
    attempt_count: int
    updated_at: datetime


class StudySessionNoteResponse(BaseModel):
    session: StudySessionRead
    note: NoteRead
