from __future__ import annotations

from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .db import get_db, init_db
from .models import (
    AudioUpload,
    Document,
    DocumentSection,
    Folder,
    Note,
    StudySession,
    Transcript,
)
from .pipeline import (
    ensure_user,
    generate_note,
    process_upload_pipeline,
    save_upload_file,
    transcribe_file,
    transcribe_upload,
)
from .schemas import (
    DocumentListItem,
    DocumentRead,
    DocumentSectionRead,
    FolderRead,
    NoteListItem,
    NoteRead,
    StudySessionCreateRequest,
    StudySessionEvaluateRequest,
    StudySessionListItem,
    StudySessionNoteResponse,
    StudySessionRead,
    TranscriptRead,
    UploadAccepted,
)
from .study_pipeline import (
    create_study_session,
    evaluate_session_recall,
    extract_document_text,
    generate_session_note,
    import_document,
)

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=settings.storage_dir), name="media")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok"}


@app.post("/audio/upload", response_model=UploadAccepted)
def upload_audio(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    user_id: str = Form(default=settings.demo_user_id),
    email: str = Form(default=settings.demo_user_email),
    display_name: str = Form(default=settings.demo_user_name),
    auto_process: bool = Form(default=True),
    db: Session = Depends(get_db),
) -> UploadAccepted:
    user = ensure_user(
        session=db,
        user_id=user_id,
        email=email,
        display_name=display_name,
    )
    stored_path = save_upload_file(audio, settings)

    upload = AudioUpload(
        user_id=user.id,
        original_filename=audio.filename or Path(stored_path).name,
        mime_type=audio.content_type,
        stored_path=stored_path,
        status="uploaded",
    )
    note = Note(
        user_id=user.id,
        processing_status="uploaded",
        title="Processing audio...",
        summary="Your transcript and structured note are being prepared.",
    )
    upload.note = note

    db.add(upload)
    db.add(note)
    db.commit()
    db.refresh(upload)
    db.refresh(note)

    if auto_process:
        background_tasks.add_task(process_upload_pipeline, upload.id, note.id)

    return UploadAccepted(
        upload_id=upload.id,
        note_id=note.id,
        status=note.processing_status,
    )


@app.post("/transcribe/{upload_id}", response_model=TranscriptRead)
def transcribe_audio(
    upload_id: str,
    db: Session = Depends(get_db),
) -> TranscriptRead:
    try:
        transcript = transcribe_upload(db, upload_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return _serialize_transcript(transcript)


@app.post("/notes/generate/{note_id}", response_model=NoteRead)
def generate_structured_note(
    note_id: str,
    db: Session = Depends(get_db),
) -> NoteRead:
    try:
        generate_note(db, note_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    note = _load_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Generated note could not be loaded.")
    return _serialize_note(note)


@app.get("/notes/{note_id}", response_model=NoteRead)
def get_note(note_id: str, db: Session = Depends(get_db)) -> NoteRead:
    note = _load_note(db, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return _serialize_note(note)


@app.get("/notes", response_model=list[NoteListItem])
def list_notes(
    user_id: str = Query(default=settings.demo_user_id),
    db: Session = Depends(get_db),
) -> list[NoteListItem]:
    notes = db.scalars(
        select(Note)
        .where(Note.user_id == user_id)
        .options(selectinload(Note.tags), selectinload(Note.folder))
        .order_by(Note.updated_at.desc())
    ).all()

    return [
        NoteListItem(
            id=note.id,
            user_id=note.user_id,
            folder_id=note.folder_id,
            title=note.title,
            summary=note.summary,
            processing_status=note.processing_status,
            folder_title=note.folder.title if note.folder else None,
            tags=[tag.name for tag in note.tags],
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note in notes
    ]


@app.get("/folders", response_model=list[FolderRead])
def list_folders(
    user_id: str = Query(default=settings.demo_user_id),
    db: Session = Depends(get_db),
) -> list[FolderRead]:
    rows = db.execute(
        select(Folder, func.count(Note.id))
        .where(Folder.user_id == user_id)
        .outerjoin(Note, Note.folder_id == Folder.id)
        .group_by(Folder.id)
        .order_by(Folder.updated_at.desc())
    ).all()

    return [
        FolderRead(
            id=folder.id,
            title=folder.title,
            description=folder.description,
            note_count=note_count,
            created_at=folder.created_at,
            updated_at=folder.updated_at,
        )
        for folder, note_count in rows
    ]


@app.post("/documents/import", response_model=DocumentRead)
def import_document_endpoint(
    document_file: UploadFile | None = File(default=None),
    raw_text: str | None = Form(default=None),
    title: str | None = Form(default=None),
    subtitle: str | None = Form(default=None),
    user_id: str = Form(default=settings.demo_user_id),
    email: str = Form(default=settings.demo_user_email),
    display_name: str = Form(default=settings.demo_user_name),
    db: Session = Depends(get_db),
) -> DocumentRead:
    user = ensure_user(
        session=db,
        user_id=user_id,
        email=email,
        display_name=display_name,
    )

    try:
        extracted_text, source_type, original_filename = extract_document_text(
            raw_text=raw_text,
            upload_file=document_file,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="The imported document has no readable text.")

    document = import_document(
        session=db,
        user=user,
        title=(title or "").strip() or _derive_document_title(extracted_text, original_filename),
        subtitle=(subtitle or "").strip() or None,
        source_type=source_type,
        raw_text=extracted_text,
        original_filename=original_filename,
    )

    loaded = _load_document(db, document.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Imported document could not be loaded.")
    return _serialize_document(loaded)


@app.get("/documents", response_model=list[DocumentListItem])
def list_documents(
    user_id: str = Query(default=settings.demo_user_id),
    db: Session = Depends(get_db),
) -> list[DocumentListItem]:
    documents = db.scalars(
        select(Document)
        .where(Document.user_id == user_id)
        .options(selectinload(Document.sections))
        .order_by(Document.updated_at.desc())
    ).all()

    return [
        DocumentListItem(
            id=document.id,
            user_id=document.user_id,
            title=document.title,
            subtitle=document.subtitle,
            source_type=document.source_type,
            section_count=len(document.sections),
            created_at=document.created_at,
            updated_at=document.updated_at,
        )
        for document in documents
    ]


@app.get("/documents/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Session = Depends(get_db)) -> DocumentRead:
    document = _load_document(db, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return _serialize_document(document)


@app.post("/sessions", response_model=StudySessionRead)
def create_session_endpoint(
    request: StudySessionCreateRequest,
    db: Session = Depends(get_db),
) -> StudySessionRead:
    user = ensure_user(
        session=db,
        user_id=request.user_id or settings.demo_user_id,
        email=request.email or settings.demo_user_email,
        display_name=request.display_name or settings.demo_user_name,
    )

    document = _load_document(db, request.document_id)
    if document is None or document.user_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found.")

    section = _resolve_section(document, request.section_id)
    if section is None:
        raise HTTPException(status_code=400, detail="A valid document section is required.")

    study_session = create_study_session(
        session=db,
        user=user,
        document=document,
        section=section,
        mode=request.mode,
    )

    loaded = _load_study_session(db, study_session.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Study session could not be loaded.")
    return _serialize_study_session(loaded)


@app.get("/sessions", response_model=list[StudySessionListItem])
def list_sessions(
    user_id: str = Query(default=settings.demo_user_id),
    db: Session = Depends(get_db),
) -> list[StudySessionListItem]:
    sessions = db.scalars(
        select(StudySession)
        .where(StudySession.user_id == user_id)
        .options(
            selectinload(StudySession.document),
            selectinload(StudySession.section),
        )
        .order_by(StudySession.updated_at.desc())
    ).all()

    return [
        StudySessionListItem(
            id=study_session.id,
            document_id=study_session.document_id,
            section_id=study_session.section_id,
            note_id=study_session.note_id,
            document_title=study_session.document.title,
            section_title=study_session.section.title,
            mode=study_session.mode,
            status=study_session.status,
            score_total=study_session.score_total,
            passed_threshold=(study_session.score_total or 0) >= study_session.threshold_score,
            attempt_count=study_session.attempt_count,
            updated_at=study_session.updated_at,
        )
        for study_session in sessions
    ]


@app.get("/sessions/{session_id}", response_model=StudySessionRead)
def get_session(session_id: str, db: Session = Depends(get_db)) -> StudySessionRead:
    study_session = _load_study_session(db, session_id)
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")
    return _serialize_study_session(study_session)


@app.post("/sessions/{session_id}/evaluate", response_model=StudySessionRead)
def evaluate_session(
    session_id: str,
    request: StudySessionEvaluateRequest,
    db: Session = Depends(get_db),
) -> StudySessionRead:
    study_session = _load_study_session(db, session_id)
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")

    updated = evaluate_session_recall(
        session=db,
        study_session=study_session,
        recall_text=request.recall_transcript,
        actual_read_seconds=request.actual_read_seconds,
    )

    loaded = _load_study_session(db, updated.id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Evaluated study session could not be loaded.")
    return _serialize_study_session(loaded)


@app.post("/sessions/{session_id}/evaluate-audio", response_model=StudySessionRead)
def evaluate_session_audio(
    session_id: str,
    audio: UploadFile = File(...),
    actual_read_seconds: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> StudySessionRead:
    study_session = _load_study_session(db, session_id)
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")

    stored_path = save_upload_file(audio, settings)
    try:
        transcript = transcribe_file(stored_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    finally:
        temp_file = Path(stored_path)
        if temp_file.exists():
            temp_file.unlink()

    transcript_text = transcript["text"].strip()
    if not transcript_text:
        raise HTTPException(status_code=400, detail="No speech was detected in the audio.")

    updated = evaluate_session_recall(
        session=db,
        study_session=study_session,
        recall_text=transcript_text,
        actual_read_seconds=actual_read_seconds,
    )

    loaded = _load_study_session(db, updated.id)
    if loaded is None:
        raise HTTPException(
            status_code=404,
            detail="Evaluated study session could not be loaded.",
        )
    return _serialize_study_session(loaded)


@app.post("/sessions/{session_id}/generate-note", response_model=StudySessionNoteResponse)
def generate_session_note_endpoint(
    session_id: str,
    db: Session = Depends(get_db),
) -> StudySessionNoteResponse:
    study_session = _load_study_session(db, session_id)
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")

    try:
        note = generate_session_note(session=db, study_session=study_session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    loaded_session = _load_study_session(db, session_id)
    loaded_note = _load_note(db, note.id)
    if loaded_session is None or loaded_note is None:
        raise HTTPException(status_code=404, detail="Generated note could not be loaded.")

    return StudySessionNoteResponse(
        session=_serialize_study_session(loaded_session),
        note=_serialize_note(loaded_note),
    )


def _load_note(db: Session, note_id: str) -> Note | None:
    return db.scalar(
        select(Note)
        .where(Note.id == note_id)
        .options(
            selectinload(Note.tags),
            selectinload(Note.folder),
            selectinload(Note.transcript),
        )
    )


def _load_document(db: Session, document_id: str) -> Document | None:
    return db.scalar(
        select(Document)
        .where(Document.id == document_id)
        .options(selectinload(Document.sections))
    )


def _load_study_session(db: Session, session_id: str) -> StudySession | None:
    return db.scalar(
        select(StudySession)
        .where(StudySession.id == session_id)
        .options(
            selectinload(StudySession.document),
            selectinload(StudySession.section),
            selectinload(StudySession.note),
        )
    )


def _resolve_section(document: Document, section_id: str | None) -> DocumentSection | None:
    if section_id:
        for section in document.sections:
            if section.id == section_id:
                return section
        return None

    if not document.sections:
        return None

    return min(document.sections, key=lambda item: item.order_index)


def _derive_document_title(text: str, original_filename: str | None) -> str:
    if original_filename:
        stem = Path(original_filename).stem.strip()
        if stem:
            return stem.replace("_", " ").replace("-", " ").title()

    first_line = next((line.strip() for line in text.splitlines() if line.strip()), "")
    if first_line:
        return first_line[:80]

    return "Imported document"


def _serialize_note(note: Note) -> NoteRead:
    return NoteRead(
        id=note.id,
        user_id=note.user_id,
        folder_id=note.folder_id,
        folder_title=note.folder.title if note.folder else None,
        audio_upload_id=note.audio_upload_id,
        processing_status=note.processing_status,
        title=note.title,
        summary=note.summary,
        cleaned_content=note.cleaned_content,
        raw_transcript=note.raw_transcript,
        key_terms=note.key_terms,
        review_questions=note.review_questions,
        suggested_folder=note.suggested_folder,
        tags=[tag.name for tag in note.tags],
        error_message=note.error_message,
        created_at=note.created_at,
        updated_at=note.updated_at,
        transcript=_serialize_transcript(note.transcript) if note.transcript else None,
    )


def _serialize_transcript(transcript: Transcript) -> TranscriptRead:
    return TranscriptRead(
        id=transcript.id,
        text=transcript.text,
        language_code=transcript.language_code,
        provider=transcript.provider,
        segments=transcript.segments or [],
        created_at=transcript.created_at,
        updated_at=transcript.updated_at,
    )


def _serialize_document(document: Document) -> DocumentRead:
    ordered_sections = sorted(document.sections, key=lambda item: item.order_index)
    return DocumentRead(
        id=document.id,
        user_id=document.user_id,
        title=document.title,
        subtitle=document.subtitle,
        source_type=document.source_type,
        original_filename=document.original_filename,
        raw_text=document.raw_text,
        section_count=len(ordered_sections),
        created_at=document.created_at,
        updated_at=document.updated_at,
        sections=[
            DocumentSectionRead(
                id=section.id,
                title=section.title,
                page_label=section.page_label,
                order_index=section.order_index,
                extracted_text=section.extracted_text,
                estimated_read_minutes=section.estimated_read_minutes,
                difficulty=section.difficulty,
                concept_count=section.concept_count,
                created_at=section.created_at,
                updated_at=section.updated_at,
            )
            for section in ordered_sections
        ],
    )


def _serialize_study_session(study_session: StudySession) -> StudySessionRead:
    return StudySessionRead(
        id=study_session.id,
        user_id=study_session.user_id,
        document_id=study_session.document_id,
        section_id=study_session.section_id,
        note_id=study_session.note_id,
        document_title=study_session.document.title,
        section_title=study_session.section.title,
        section_page_label=study_session.section.page_label,
        mode=study_session.mode,
        status=study_session.status,
        actual_read_seconds=study_session.actual_read_seconds,
        attempt_count=study_session.attempt_count,
        threshold_score=study_session.threshold_score,
        passed_threshold=(study_session.score_total or 0) >= study_session.threshold_score,
        recall_transcript=study_session.recall_transcript,
        score_total=study_session.score_total,
        recall_score=study_session.recall_score,
        accuracy_score=study_session.accuracy_score,
        detail_score=study_session.detail_score,
        missing_concept_count=study_session.missing_concept_count,
        misconception_count=study_session.misconception_count,
        strengths=study_session.strengths,
        specific_feedback=study_session.specific_feedback,
        missing_pieces=study_session.missing_pieces,
        misconceptions=study_session.misconceptions,
        error_message=study_session.error_message,
        created_at=study_session.created_at,
        updated_at=study_session.updated_at,
    )
