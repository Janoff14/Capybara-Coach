from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


note_tags = Table(
    "note_tags",
    Base.metadata,
    Column("note_id", String(64), ForeignKey("notes.id"), primary_key=True),
    Column("tag_id", String(64), ForeignKey("tags.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    folders: Mapped[list[Folder]] = relationship(back_populates="user")
    uploads: Mapped[list[AudioUpload]] = relationship(back_populates="user")
    notes: Mapped[list[Note]] = relationship(back_populates="user")
    documents: Mapped[list[Document]] = relationship(back_populates="user")
    study_sessions: Mapped[list[StudySession]] = relationship(back_populates="user")


class Folder(Base):
    __tablename__ = "folders"
    __table_args__ = (UniqueConstraint("user_id", "title", name="uq_folders_user_title"),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="folders")
    notes: Mapped[list[Note]] = relationship(back_populates="folder")


class AudioUpload(Base):
    __tablename__ = "audio_uploads"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    stored_path: Mapped[str] = mapped_column(String(512))
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="uploads")
    transcript: Mapped[Transcript | None] = relationship(back_populates="audio_upload", uselist=False)
    note: Mapped[Note | None] = relationship(back_populates="audio_upload", uselist=False)


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    audio_upload_id: Mapped[str] = mapped_column(ForeignKey("audio_uploads.id"), unique=True, index=True)
    text: Mapped[str] = mapped_column(Text)
    language_code: Mapped[str] = mapped_column(String(32), default="en")
    provider: Mapped[str] = mapped_column(String(64), default="faster-whisper")
    segments: Mapped[list[dict]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    audio_upload: Mapped[AudioUpload] = relationship(back_populates="transcript")
    note: Mapped[Note | None] = relationship(back_populates="transcript", uselist=False)


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    audio_upload_id: Mapped[str | None] = mapped_column(ForeignKey("audio_uploads.id"), unique=True, nullable=True)
    transcript_id: Mapped[str | None] = mapped_column(ForeignKey("transcripts.id"), unique=True, nullable=True)
    folder_id: Mapped[str | None] = mapped_column(ForeignKey("folders.id"), nullable=True, index=True)
    processing_status: Mapped[str] = mapped_column(String(32), default="uploaded", index=True)
    title: Mapped[str] = mapped_column(String(255), default="Processing audio...")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    cleaned_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_terms: Mapped[list[str]] = mapped_column(JSON, default=list)
    review_questions: Mapped[list[str]] = mapped_column(JSON, default=list)
    suggested_folder: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="notes")
    audio_upload: Mapped[AudioUpload | None] = relationship(back_populates="note")
    transcript: Mapped[Transcript | None] = relationship(back_populates="note")
    folder: Mapped[Folder | None] = relationship(back_populates="notes")
    tags: Mapped[list[Tag]] = relationship(secondary=note_tags, back_populates="notes")


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)

    notes: Mapped[list[Note]] = relationship(secondary=note_tags, back_populates="tags")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    subtitle: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="text")
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="documents")
    sections: Mapped[list[DocumentSection]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentSection.order_index",
    )
    study_sessions: Mapped[list[StudySession]] = relationship(back_populates="document")


class DocumentSection(Base):
    __tablename__ = "document_sections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    page_label: Mapped[str] = mapped_column(String(255))
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    extracted_text: Mapped[str] = mapped_column(Text)
    estimated_read_minutes: Mapped[int] = mapped_column(Integer, default=5)
    difficulty: Mapped[str] = mapped_column(String(32), default="standard")
    concept_count: Mapped[int] = mapped_column(Integer, default=4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    document: Mapped[Document] = relationship(back_populates="sections")
    study_sessions: Mapped[list[StudySession]] = relationship(back_populates="section")


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), index=True)
    section_id: Mapped[str] = mapped_column(ForeignKey("document_sections.id"), index=True)
    mode: Mapped[str] = mapped_column(String(32), default="assisted")
    status: Mapped[str] = mapped_column(String(32), default="reading", index=True)
    actual_read_seconds: Mapped[int] = mapped_column(Integer, default=0)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    recall_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    score_total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recall_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accuracy_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    missing_concept_count: Mapped[int] = mapped_column(Integer, default=0)
    misconception_count: Mapped[int] = mapped_column(Integer, default=0)
    strengths: Mapped[list[str]] = mapped_column(JSON, default=list)
    specific_feedback: Mapped[list[str]] = mapped_column(JSON, default=list)
    missing_pieces: Mapped[list[str]] = mapped_column(JSON, default=list)
    misconceptions: Mapped[list[str]] = mapped_column(JSON, default=list)
    threshold_score: Mapped[int] = mapped_column(Integer, default=70)
    note_id: Mapped[str | None] = mapped_column(ForeignKey("notes.id"), unique=True, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user: Mapped[User] = relationship(back_populates="study_sessions")
    document: Mapped[Document] = relationship(back_populates="study_sessions")
    section: Mapped[DocumentSection] = relationship(back_populates="study_sessions")
    note: Mapped[Note | None] = relationship()
