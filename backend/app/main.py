from __future__ import annotations

from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .config import get_settings
from .db import get_db, init_db
from .models import AudioUpload, Folder, Note, Transcript
from .pipeline import ensure_user, generate_note, process_upload_pipeline, save_upload_file, transcribe_upload
from .schemas import FolderRead, NoteListItem, NoteRead, TranscriptRead, UploadAccepted

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
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return _serialize_transcript(transcript)


@app.post("/notes/generate/{note_id}", response_model=NoteRead)
def generate_structured_note(
    note_id: str,
    db: Session = Depends(get_db),
) -> NoteRead:
    try:
        note = generate_note(db, note_id)
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
            title=note.title,
            summary=note.summary,
            processing_status=note.processing_status,
            folder_title=note.folder.title if note.folder else None,
            tags=[tag.name for tag in note.tags],
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
