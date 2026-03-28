from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.document import Document
from app.models.note import Note
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.session import RecallHintRead, SessionCreate, StudySessionRead
from app.services.ai import (
    ASSESSMENT_PROTOCOL_VERSION,
    assess_transcript,
    generate_notes,
    generate_recall_hint,
    merge_recall_transcript,
    transcribe_audio,
)
from app.services.auth import get_current_user
from app.services.storage import build_object_path, download_bytes, sanitize_filename, upload_bytes

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _coerce_int(value: object, default: int = -1) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _session_query():
    return select(StudySession).options(
        joinedload(StudySession.note),
        joinedload(StudySession.document),
    )


def _get_session_or_404(db: Session, session_id: str, user_id: str) -> StudySession:
    statement = _session_query().where(
        StudySession.id == session_id,
        StudySession.user_id == user_id,
    )
    study_session = db.scalars(statement).unique().one_or_none()
    if study_session is None:
        raise HTTPException(status_code=404, detail="Study session not found.")
    return study_session


@router.get("", response_model=list[StudySessionRead])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[StudySession]:
    statement = (
        _session_query()
        .where(StudySession.user_id == current_user.id)
        .order_by(StudySession.created_at.desc())
    )
    return list(db.scalars(statement).unique())


@router.get("/{session_id}", response_model=StudySessionRead)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    return _get_session_or_404(db, session_id, current_user.id)


@router.post("", response_model=StudySessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    statement = select(Document).where(
        Document.id == payload.document_id,
        Document.user_id == current_user.id,
    )
    document = db.scalars(statement).one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    study_session = StudySession(
        user_id=current_user.id,
        document_id=document.id,
        status="created",
    )
    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, study_session.id, current_user.id)


@router.post("/{session_id}/finish-reading", response_model=StudySessionRead)
def finish_reading(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    study_session.status = "reading_complete"
    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, session_id, current_user.id)


@router.post("/{session_id}/audio", response_model=StudySessionRead)
def upload_audio(
    session_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    filename = file.filename or "audio.wav"
    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty.")

    object_path = build_object_path(
        "users",
        study_session.user_id,
        "sessions",
        study_session.id,
        f"{study_session.id}-{sanitize_filename(filename)}",
    )

    try:
        upload_bytes(
            settings=settings,
            bucket=settings.supabase_audio_bucket,
            object_path=object_path,
            payload=payload,
            content_type=file.content_type,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if study_session.note is not None:
        db.delete(study_session.note)
        study_session.note = None

    study_session.audio_filename = filename
    study_session.audio_content_type = file.content_type
    study_session.audio_storage_bucket = settings.supabase_audio_bucket
    study_session.audio_storage_path = object_path
    study_session.transcript_text = None
    study_session.transcript_provider = None
    study_session.assessment_score = None
    study_session.assessment_feedback = None
    study_session.assessment_json = None
    study_session.status = "audio_uploaded"

    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, session_id, current_user.id)


@router.post("/{session_id}/recall-hint", response_model=RecallHintRead)
def recall_hint(
    session_id: str,
    file: UploadFile = File(...),
    cumulative_transcript: str = Form(""),
    strictness: int = Form(50),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> RecallHintRead:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded audio is empty.")

    transcript_text = ""

    try:
        transcript_result = transcribe_audio(
            filename=file.filename or "recall.webm",
            payload=payload,
            settings=settings,
        )
        transcript_text = str(transcript_result.get("text") or "").strip()
    except RuntimeError:
        if not cumulative_transcript.strip():
            raise

    transcript_so_far = merge_recall_transcript(cumulative_transcript, transcript_text)
    if not transcript_so_far:
        raise HTTPException(status_code=400, detail="No speech was detected in the audio.")

    hint = generate_recall_hint(
        transcript_so_far=transcript_so_far,
        latest_chunk=transcript_text,
        source_text=study_session.document.extracted_text,
        document_title=study_session.document.title,
        reader_guide=study_session.document.reader_json,
        strictness=strictness,
        settings=settings,
    )

    return RecallHintRead.model_validate(hint)


@router.post("/{session_id}/transcribe", response_model=StudySessionRead)
def run_transcription(
    session_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    if not study_session.audio_storage_path or not study_session.audio_storage_bucket:
        raise HTTPException(status_code=400, detail="Upload audio before transcription.")

    try:
        audio_payload = download_bytes(
            settings=settings,
            bucket=study_session.audio_storage_bucket,
            object_path=study_session.audio_storage_path,
        )
        result = transcribe_audio(
            filename=study_session.audio_filename or "audio.wav",
            payload=audio_payload,
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    transcript_text = result["text"].strip()
    if not transcript_text:
        raise HTTPException(status_code=400, detail="No speech was detected in the audio.")

    study_session.transcript_text = transcript_text
    study_session.transcript_provider = result["provider"]
    study_session.status = "transcribed"

    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, session_id, current_user.id)


@router.post("/{session_id}/assess", response_model=StudySessionRead)
def run_assessment(
    session_id: str,
    strictness: int = Query(50, ge=0, le=100),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    if not study_session.transcript_text:
        raise HTTPException(status_code=400, detail="Transcribe audio before assessment.")

    existing_assessment = study_session.assessment_json or {}
    if (
        isinstance(existing_assessment, dict)
        and _coerce_int(existing_assessment.get("strictness")) == strictness
        and _coerce_int(existing_assessment.get("protocol_version")) == ASSESSMENT_PROTOCOL_VERSION
    ):
        return _get_session_or_404(db, session_id, current_user.id)

    try:
        assessment = assess_transcript(
            transcript=study_session.transcript_text,
            source_text=study_session.document.extracted_text,
            strictness=strictness,
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    study_session.assessment_score = int(assessment["score"])
    study_session.assessment_feedback = str(assessment["feedback"])
    study_session.assessment_json = assessment
    study_session.status = "assessed"

    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, session_id, current_user.id)


@router.post("/{session_id}/notes", response_model=StudySessionRead)
def create_notes(
    session_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> StudySession:
    study_session = _get_session_or_404(db, session_id, current_user.id)
    if study_session.assessment_json is None or not study_session.transcript_text:
        raise HTTPException(status_code=400, detail="Assess the session before generating notes.")

    try:
        note_payload = generate_notes(
            transcript=study_session.transcript_text,
            source_text=study_session.document.extracted_text,
            assessment=study_session.assessment_json,
            document_title=study_session.document.title,
            settings=settings,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    note = study_session.note
    if note is None:
        note = Note(
            study_session_id=study_session.id,
            user_id=study_session.user_id,
            title=note_payload["title"],
            summary=note_payload["summary"],
            content=note_payload["content"],
            note_json=note_payload,
        )
    else:
        note.title = note_payload["title"]
        note.summary = note_payload["summary"]
        note.content = note_payload["content"]
        note.note_json = note_payload

    study_session.note = note
    db.add(note)
    study_session.status = "notes_ready"
    db.add(study_session)
    db.commit()
    return _get_session_or_404(db, session_id, current_user.id)
