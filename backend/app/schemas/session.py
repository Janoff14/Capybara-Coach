from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .note import NoteRead


class SessionCreate(BaseModel):
    document_id: str


class NoteRecallSessionCreate(BaseModel):
    note_id: str


TypedChunkCategory = Literal["study_material", "note_only", "ai_direction"]


class TypedCaptureChunk(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=4000)
    category: TypedChunkCategory
    created_at: datetime

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Chunk content cannot be empty.")
        return normalized


class TypedCaptureUpdate(BaseModel):
    chunks: list[TypedCaptureChunk] = Field(max_length=200)


class StudySessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_id: str
    source_note_id: str | None
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


class RecallHintRead(BaseModel):
    state: str
    prompt_type: str
    message: str
    missing_concepts: list[str]
    transcript_excerpt: str
    transcript_so_far: str
    source: str
    debug_reason: str | None = None
