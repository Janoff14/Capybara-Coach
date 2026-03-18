from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .config import Settings, get_settings
from .db import SessionLocal
from .models import AudioUpload, Folder, Note, Tag, Transcript, User, utc_now


def save_upload_file(upload_file: UploadFile, settings: Settings | None = None) -> str:
    runtime = settings or get_settings()
    extension = Path(upload_file.filename or "audio.wav").suffix or ".wav"
    stored_name = f"{uuid4()}{extension}"
    destination = runtime.storage_dir / "audio" / stored_name

    upload_file.file.seek(0)
    destination.write_bytes(upload_file.file.read())
    return str(destination)


def ensure_user(
    session: Session,
    user_id: str,
    email: str | None = None,
    display_name: str | None = None,
) -> User:
    user = session.get(User, user_id)
    if user is not None:
        return user

    user = User(
        id=user_id,
        email=email,
        display_name=display_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@lru_cache(maxsize=1)
def _load_whisper_model():
    settings = get_settings()

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:  # pragma: no cover - import guard
        raise RuntimeError(
            "faster-whisper is not installed. Install backend requirements before transcribing."
        ) from exc

    return WhisperModel(
        settings.faster_whisper_model,
        device=settings.faster_whisper_device,
        compute_type=settings.faster_whisper_compute_type,
    )


def transcribe_file(audio_path: str) -> dict:
    model = _load_whisper_model()
    segments, info = model.transcribe(audio_path)
    collected_segments: list[dict] = []
    lines: list[str] = []

    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        collected_segments.append(
            {
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": text,
            }
        )
        lines.append(text)

    return {
        "text": " ".join(lines).strip(),
        "language_code": getattr(info, "language", "en") or "en",
        "provider": "faster-whisper",
        "segments": collected_segments,
    }


def _request_llm_json(transcript: str, settings: Settings) -> dict | None:
    if not settings.llm_api_key or not settings.llm_model:
        return None

    prompt = """
Return a JSON object with these keys:
- title
- summary
- cleaned_content
- key_terms
- review_questions
- tags
- suggested_folder
- folder_description

Rules:
- Produce concise study-note output.
- Keep cleaned_content in readable markdown-like plain text.
- key_terms, review_questions, and tags must be arrays of strings.
- tags should be short slugs or compact topic phrases.
"""

    payload = {
        "model": settings.llm_model,
        "messages": [
            {
                "role": "system",
                "content": "You turn raw voice transcripts into clean study notes and tags.",
            },
            {
                "role": "user",
                "content": f"{prompt}\n\nTranscript:\n{transcript}",
            },
        ],
        "response_format": {"type": "json_object"},
    }

    with httpx.Client(
        base_url=settings.llm_base_url.rstrip("/"),
        timeout=settings.llm_timeout_seconds,
        headers={
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        },
    ) as client:
        response = client.post("/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(
            part.get("text", "")
            for part in content
            if isinstance(part, dict)
        )

    return _safe_json_load(content)


def _safe_json_load(content: str) -> dict | None:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def heuristic_note(transcript: str) -> dict:
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", transcript)
        if sentence.strip()
    ]
    title = (sentences[0] if sentences else "Voice note").strip()[:80]
    summary = " ".join(sentences[:2]).strip() or transcript[:160].strip()

    words: dict[str, int] = {}
    for token in re.split(r"[^a-zA-Z0-9]+", transcript.lower()):
        if len(token) < 4:
            continue
        words[token] = words.get(token, 0) + 1

    ranked = [word for word, _ in sorted(words.items(), key=lambda item: item[1], reverse=True)]
    key_terms = [word.title() for word in ranked[:6]]
    tags = [word.replace(" ", "-") for word in ranked[:5]]
    folder = key_terms[0] if key_terms else "General Notes"

    cleaned_lines = [
        "Overview",
        summary,
        "",
        "Key points",
        *[f"- {sentence.rstrip('.!?')}" for sentence in sentences[:4]],
    ]

    return {
        "title": title or "Voice note",
        "summary": summary,
        "cleaned_content": "\n".join(line for line in cleaned_lines if line is not None).strip(),
        "key_terms": key_terms,
        "review_questions": [
            "How would you explain this note in your own words?",
            "What detail would you want to remember on review?",
        ],
        "tags": tags,
        "suggested_folder": folder,
        "folder_description": f"Auto-generated notes related to {folder}.",
    }


def generate_note_payload(transcript: str, settings: Settings | None = None) -> dict:
    runtime = settings or get_settings()

    try:
        generated = _request_llm_json(transcript, runtime)
    except Exception:
        generated = None

    normalized = generated or heuristic_note(transcript)
    return {
        "title": str(normalized.get("title") or "Voice note"),
        "summary": str(normalized.get("summary") or transcript[:160]),
        "cleaned_content": str(normalized.get("cleaned_content") or transcript),
        "key_terms": _normalize_string_list(normalized.get("key_terms")),
        "review_questions": _normalize_string_list(normalized.get("review_questions")),
        "tags": _normalize_string_list(normalized.get("tags")),
        "suggested_folder": str(normalized.get("suggested_folder") or "General Notes"),
        "folder_description": str(
            normalized.get("folder_description")
            or "Auto-generated notes from recorded audio."
        ),
    }


def _normalize_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def transcribe_upload(session: Session, upload_id: str) -> Transcript:
    upload = session.get(AudioUpload, upload_id)
    if upload is None:
        raise ValueError(f"Audio upload '{upload_id}' was not found.")

    note = upload.note
    upload.status = "transcribing"
    if note is not None:
        note.processing_status = "transcribing"
        note.error_message = None
    session.commit()

    result = transcribe_file(upload.stored_path)
    transcript = upload.transcript
    if transcript is None:
        transcript = Transcript(
            audio_upload_id=upload.id,
            text=result["text"],
            language_code=result["language_code"],
            provider=result["provider"],
            segments=result["segments"],
        )
        session.add(transcript)
    else:
        transcript.text = result["text"]
        transcript.language_code = result["language_code"]
        transcript.provider = result["provider"]
        transcript.segments = result["segments"]
        transcript.updated_at = utc_now()

    upload.status = "transcribed"
    upload.updated_at = utc_now()
    if note is not None:
        note.transcript = transcript
        note.raw_transcript = transcript.text
        note.processing_status = "transcribed"
        note.updated_at = utc_now()

    session.commit()
    session.refresh(transcript)
    return transcript


def generate_note(session: Session, note_id: str) -> Note:
    note = session.scalar(
        select(Note)
        .where(Note.id == note_id)
        .options(
            selectinload(Note.tags),
            selectinload(Note.folder),
            selectinload(Note.transcript),
            selectinload(Note.user),
        )
    )
    if note is None:
        raise ValueError(f"Note '{note_id}' was not found.")

    transcript_text = note.raw_transcript or (note.transcript.text if note.transcript else "")
    if not transcript_text.strip():
        raise ValueError("No transcript exists for this note yet.")

    note.processing_status = "generating"
    note.error_message = None
    note.updated_at = utc_now()
    session.commit()

    generated = generate_note_payload(transcript_text)
    folder = _find_or_create_folder(
        session=session,
        user_id=note.user_id,
        title=generated["suggested_folder"],
        description=generated["folder_description"],
    )
    tags = _find_or_create_tags(session, generated["tags"])

    note.folder = folder
    note.processing_status = "ready"
    note.title = generated["title"]
    note.summary = generated["summary"]
    note.cleaned_content = generated["cleaned_content"]
    note.raw_transcript = transcript_text
    note.key_terms = generated["key_terms"]
    note.review_questions = generated["review_questions"]
    note.suggested_folder = generated["suggested_folder"]
    note.tags = tags
    note.updated_at = utc_now()
    session.commit()
    session.refresh(note)
    return note


def process_upload_pipeline(upload_id: str, note_id: str) -> None:
    with SessionLocal() as session:
        upload = session.get(AudioUpload, upload_id)
        note = session.get(Note, note_id)

        if upload is None or note is None:
            return

        try:
            transcribe_upload(session, upload_id)
            generate_note(session, note_id)
            upload.status = "ready"
            upload.updated_at = utc_now()
            session.commit()
        except Exception as exc:  # pragma: no cover - background fallback
            upload.status = "failed"
            upload.updated_at = utc_now()
            note.processing_status = "failed"
            note.error_message = str(exc)
            note.updated_at = utc_now()
            session.commit()


def _find_or_create_folder(
    session: Session,
    user_id: str,
    title: str,
    description: str | None,
) -> Folder:
    folder = session.scalar(
        select(Folder).where(
            Folder.user_id == user_id,
            Folder.title == title,
        )
    )
    if folder is not None:
        return folder

    folder = Folder(
        user_id=user_id,
        title=title,
        description=description,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder


def _find_or_create_tags(session: Session, tag_names: list[str]) -> list[Tag]:
    tags: list[Tag] = []

    for name in tag_names:
        tag = session.scalar(select(Tag).where(Tag.name == name))
        if tag is None:
            tag = Tag(name=name)
            session.add(tag)
            session.commit()
            session.refresh(tag)
        tags.append(tag)

    return tags
