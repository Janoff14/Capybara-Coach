from __future__ import annotations

import json
import re
from difflib import SequenceMatcher
from io import BytesIO

import httpx
from fastapi import UploadFile
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .models import Document, DocumentSection, Note, StudySession, User, utc_now
from .pipeline import _find_or_create_folder, _find_or_create_tags


def extract_document_text(
    *,
    raw_text: str | None,
    upload_file: UploadFile | None,
) -> tuple[str, str, str | None]:
    if raw_text and raw_text.strip():
        return raw_text.strip(), "text", None

    if upload_file is None:
        raise ValueError("Provide either raw_text or a file upload.")

    filename = upload_file.filename or "document.txt"
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else "txt"
    payload = upload_file.file.read()
    upload_file.file.seek(0)

    if suffix == "pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "PDF support requires pypdf to be installed."
            ) from exc

        reader = PdfReader(BytesIO(payload))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n\n".join(page.strip() for page in pages if page.strip())
        return text.strip(), "pdf", filename

    try:
        text = payload.decode("utf-8")
    except UnicodeDecodeError:
        text = payload.decode("latin-1")

    return text.strip(), "text", filename


def import_document(
    *,
    session: Session,
    user: User,
    title: str,
    subtitle: str | None,
    source_type: str,
    raw_text: str,
    original_filename: str | None,
) -> Document:
    sections = _build_sections(title=title, text=raw_text)
    document = Document(
      user_id=user.id,
      title=title,
      subtitle=subtitle,
      source_type=source_type,
      original_filename=original_filename,
      raw_text=raw_text,
      sections=sections,
    )
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


def create_study_session(
    *,
    session: Session,
    user: User,
    document: Document,
    section: DocumentSection,
    mode: str,
) -> StudySession:
    study_session = StudySession(
        user_id=user.id,
        document_id=document.id,
        section_id=section.id,
        mode=mode,
        status="reading",
        threshold_score=70,
    )
    session.add(study_session)
    session.commit()
    session.refresh(study_session)
    return study_session


def evaluate_session_recall(
    *,
    session: Session,
    study_session: StudySession,
    recall_text: str,
    actual_read_seconds: int | None = None,
) -> StudySession:
    source_text = study_session.section.extracted_text
    feedback = _evaluate_recall_text(source_text=source_text, recall_text=recall_text)

    study_session.status = "feedback_ready"
    study_session.attempt_count += 1
    study_session.recall_transcript = recall_text.strip()
    if actual_read_seconds is not None:
        study_session.actual_read_seconds = max(0, actual_read_seconds)
    study_session.score_total = feedback["breakdown"]["total_score"]
    study_session.recall_score = feedback["breakdown"]["recall_score"]
    study_session.accuracy_score = feedback["breakdown"]["accuracy_score"]
    study_session.detail_score = feedback["breakdown"]["detail_score"]
    study_session.missing_concept_count = feedback["breakdown"]["missing_concept_count"]
    study_session.misconception_count = feedback["breakdown"]["misconception_count"]
    study_session.strengths = feedback["strengths"]
    study_session.specific_feedback = feedback["specific_feedback"]
    study_session.missing_pieces = feedback["missing_pieces"]
    study_session.misconceptions = feedback["misconceptions"]
    study_session.threshold_score = feedback["threshold_score"]
    study_session.error_message = None
    study_session.updated_at = utc_now()

    session.commit()
    session.refresh(study_session)
    return study_session


def generate_session_note(
    *,
    session: Session,
    study_session: StudySession,
    settings: Settings | None = None,
) -> Note:
    if not study_session.recall_transcript or not study_session.recall_transcript.strip():
        raise ValueError("The session has no recall transcript yet.")

    if (study_session.score_total or 0) < study_session.threshold_score:
        raise ValueError("The session has not passed the recall threshold yet.")

    runtime = settings or get_settings()
    payload = generate_session_note_payload(
        section_title=study_session.section.title,
        source_text=study_session.section.extracted_text,
        recall_text=study_session.recall_transcript,
        feedback_data={
            "strengths": study_session.strengths,
            "specific_feedback": study_session.specific_feedback,
            "missing_pieces": study_session.missing_pieces,
            "misconceptions": study_session.misconceptions,
        },
        settings=runtime,
    )

    folder = _find_or_create_folder(
        session=session,
        user_id=study_session.user_id,
        title=payload["suggested_folder"],
        description=payload["folder_description"],
    )
    tags = _find_or_create_tags(session, payload["tags"])

    note = study_session.note or Note(user_id=study_session.user_id)
    note.folder = folder
    note.processing_status = "ready"
    note.title = payload["title"]
    note.summary = payload["summary"]
    note.cleaned_content = payload["cleaned_content"]
    note.raw_transcript = study_session.recall_transcript
    note.key_terms = payload["key_terms"]
    note.review_questions = payload["review_questions"]
    note.suggested_folder = payload["suggested_folder"]
    note.tags = tags
    note.updated_at = utc_now()

    session.add(note)
    session.commit()
    session.refresh(note)

    study_session.note_id = note.id
    study_session.status = "complete"
    study_session.updated_at = utc_now()
    session.commit()
    session.refresh(study_session)
    return note


def generate_session_note_payload(
    *,
    section_title: str,
    source_text: str,
    recall_text: str,
    feedback_data: dict,
    settings: Settings | None = None,
) -> dict:
    runtime = settings or get_settings()

    try:
        generated = _request_llm_json(
            section_title=section_title,
            source_text=source_text,
            recall_text=recall_text,
            feedback_data=feedback_data,
            settings=runtime,
        )
    except Exception:
        generated = None

    normalized = generated or _heuristic_session_note(
        section_title=section_title,
        source_text=source_text,
        recall_text=recall_text,
        feedback_data=feedback_data,
    )
    return {
        "title": str(normalized.get("title") or f"{section_title} review note"),
        "summary": str(
            normalized.get("summary")
            or "A corrected study note built from the recall attempt and the source."
        ),
        "cleaned_content": str(normalized.get("cleaned_content") or recall_text),
        "key_terms": _normalize_string_list(normalized.get("key_terms")),
        "review_questions": _normalize_string_list(normalized.get("review_questions")),
        "tags": _normalize_string_list(normalized.get("tags")),
        "suggested_folder": str(normalized.get("suggested_folder") or "Active Recall Notes"),
        "folder_description": str(
            normalized.get("folder_description")
            or "Corrected notes generated from document study sessions."
        ),
    }


def _build_sections(*, title: str, text: str) -> list[DocumentSection]:
    chunks = _chunk_text(text)
    return [
        DocumentSection(
            title="Core section" if len(chunks) == 1 else f"Section {index + 1}",
            page_label="Selected text" if len(chunks) == 1 else f"Part {index + 1} of {len(chunks)}",
            order_index=index,
            extracted_text=chunk,
            estimated_read_minutes=_estimate_read_minutes(chunk),
            difficulty=_estimate_difficulty(chunk),
            concept_count=_estimate_concepts(chunk),
        )
        for index, chunk in enumerate(chunks)
    ]


def _chunk_text(text: str) -> list[str]:
    paragraphs = [
        item.strip()
        for item in re.split(r"\n\s*\n", text)
        if item.strip()
    ]
    if len(paragraphs) >= 2:
        return paragraphs[:4]

    sentences = [
        item.strip()
        for item in re.split(r"(?<=[.!?])\s+", text)
        if item.strip()
    ]
    if len(sentences) <= 4:
        return [text.strip()]

    chunks: list[str] = []
    for index in range(0, len(sentences), 4):
        chunks.append(" ".join(sentences[index : index + 4]).strip())
    return chunks


def _estimate_concepts(text: str) -> int:
    return max(3, min(8, len(re.split(r"(?<=[.!?])\s+", text))))


def _estimate_difficulty(text: str) -> str:
    words = len([word for word in re.split(r"\s+", text) if word])
    if words < 90:
        return "beginner"
    if words < 180:
        return "standard"
    return "advanced"


def _estimate_read_minutes(text: str) -> int:
    words = len([word for word in re.split(r"\s+", text) if word])
    return max(3, min(12, (words + 169) // 170))


def _evaluate_recall_text(*, source_text: str, recall_text: str) -> dict:
    source_terms = _extract_signals(source_text)
    recall_terms = _extract_signals(recall_text)
    overlap = [term for term in source_terms if _contains_similar_term(term, recall_terms)]
    missing = [term for term in source_terms if not _contains_similar_term(term, recall_terms)]
    introduced = [term for term in recall_terms if not _contains_similar_term(term, source_terms)]
    terminology_signals = source_terms[:5]
    terminology_hits = [
        term for term in terminology_signals if _contains_similar_term(term, recall_terms)
    ]
    detail_signals = _extract_detail_signals(source_text)
    recall_detail_terms = _extract_detail_signals(recall_text) + recall_terms
    recalled_details = [
        detail for detail in detail_signals if _contains_similar_term(detail, recall_detail_terms)
    ]

    recall_score = round((len(overlap) / max(1, len(source_terms))) * 100)
    detail_coverage_score = round((len(recalled_details) / max(1, len(detail_signals))) * 100)
    terminology_score = round((len(terminology_hits) / max(1, len(terminology_signals))) * 100)
    detail_score = round((detail_coverage_score * 0.55) + (terminology_score * 0.45))
    accuracy_penalty = min(45, len(introduced) * 11)
    missing_penalty = min(12, len(missing[:3]) * 4)
    accuracy_score = max(35, min(97, 96 - accuracy_penalty - missing_penalty))
    total_score = max(
        0,
        min(
            100,
            round((recall_score * 0.45) + (accuracy_score * 0.35) + (detail_score * 0.20)),
        ),
    )

    strengths = []
    if overlap:
        strengths.append(f"You clearly retained {overlap[0]}.")
    if len(terminology_hits) >= 2:
        strengths.append(
            "You used multiple key terms from the source instead of only broad paraphrase."
        )
    if recalled_details:
        strengths.append("You included useful specifics instead of only broad summary.")
    if len(overlap) >= max(1, len(source_terms) / 2):
        strengths.append("Your retelling covered more than half of the core concepts.")

    specific_feedback = []
    if total_score >= 70:
        specific_feedback.append(
            "Good pass. The recall is strong enough to earn a corrected note, but the missing concepts still matter for later review."
        )
    else:
        specific_feedback.append(
            "You are below the pass gate because too many core ideas or accurate details were missing from the retelling."
        )
    if accuracy_score < 65:
        specific_feedback.append(
            "Definitions or distinctions were shaky, or you introduced claims the source did not support."
        )
    if detail_score < 55:
        specific_feedback.append(
            "You need more specifics such as key terms, examples, names, dates, or process steps."
        )
    else:
        specific_feedback.append("Your level of detail is solid for a first recall attempt.")

    return {
        "breakdown": {
            "total_score": total_score,
            "recall_score": max(0, min(100, recall_score)),
            "accuracy_score": accuracy_score,
            "detail_score": max(0, min(100, detail_score)),
            "missing_concept_count": len(missing[:4]),
            "misconception_count": len(introduced[:3]),
        },
        "strengths": strengths,
        "specific_feedback": specific_feedback,
        "missing_pieces": [f"You did not clearly mention {item}." for item in missing[:4]],
        "misconceptions": [
            f"You introduced {item} without support from the reading."
            for item in introduced[:3]
        ],
        "threshold_score": 70,
    }


def _request_llm_json(
    *,
    section_title: str,
    source_text: str,
    recall_text: str,
    feedback_data: dict,
    settings: Settings,
) -> dict | None:
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
- Preserve the user's correct phrasing when it is accurate.
- Correct missing or unsupported ideas using the source text.
- Keep cleaned_content readable in markdown-like plain text.
- key_terms, review_questions, and tags must be arrays of strings.
"""

    payload = {
        "model": settings.llm_model,
        "messages": [
            {
                "role": "system",
                "content": "You turn active-recall attempts into corrected study notes.",
            },
            {
                "role": "user",
                "content": (
                    f"{prompt}\n\n"
                    f"Section title:\n{section_title}\n\n"
                    f"Source text:\n{source_text}\n\n"
                    f"User recall transcript:\n{recall_text}\n\n"
                    f"Feedback summary:\n{json.dumps(feedback_data, ensure_ascii=False)}"
                ),
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


def _heuristic_session_note(
    *,
    section_title: str,
    source_text: str,
    recall_text: str,
    feedback_data: dict,
) -> dict:
    source_sentences = [
        item.strip()
        for item in re.split(r"(?<=[.!?])\s+", source_text)
        if item.strip()
    ]
    strengths = feedback_data.get("strengths", [])[:2]
    corrections = feedback_data.get("missing_pieces", [])[:3]
    concepts = _extract_terms(source_text)

    content = [
        "What you explained correctly",
        *[f"- {item}" for item in strengths],
        "",
        "Memory correction layer",
        *[f"- {item}" for item in corrections],
        "",
        "Corrected study note",
        "Your own wording is preserved when accurate, then corrected with the source where needed.",
        "",
        recall_text.strip() or "No recall transcript was provided.",
        "",
        "Source-backed correction",
        " ".join(source_sentences[:2]).strip(),
    ]

    return {
        "title": f"{section_title} review note",
        "summary": "A corrected study note built from the recall attempt and the source text.",
        "cleaned_content": "\n".join(line for line in content if line is not None).strip(),
        "key_terms": concepts[:6],
        "review_questions": [
            f"How would you explain {section_title} again without looking?",
            "Which missing concept caused the biggest drop in the score?",
        ],
        "tags": [term.lower().replace(" ", "-") for term in concepts[:4]],
        "suggested_folder": concepts[0] if concepts else "Active Recall Notes",
        "folder_description": "Corrected notes generated from active recall study sessions.",
    }


def _extract_signals(text: str) -> list[str]:
    stop_words = {
        "the",
        "and",
        "that",
        "with",
        "this",
        "from",
        "into",
        "your",
        "about",
        "then",
        "they",
        "them",
        "because",
        "while",
        "where",
        "there",
        "their",
        "would",
        "could",
        "should",
        "have",
        "has",
    }
    counts: dict[str, int] = {}
    for token in re.split(r"[^a-z0-9]+", text.lower()):
        if len(token) <= 4 or token in stop_words:
            continue
        counts[token] = counts.get(token, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    return [item[0] for item in ranked[:8]]


def _extract_detail_signals(text: str) -> list[str]:
    stop_words = {
        "therefore",
        "because",
        "between",
        "without",
        "through",
        "before",
        "should",
    }
    tokens = sorted(
        {
            word.lower()
            for word in re.split(r"[^A-Za-z0-9]+", text)
            if len(word) > 6 and word.lower() not in stop_words
        }
    )
    return tokens[:10]


def _extract_terms(text: str) -> list[str]:
    terms = sorted(
        {
            word.capitalize()
            for word in re.split(r"[^A-Za-z0-9]+", text)
            if len(word) > 4
        }
    )
    return terms


def _contains_similar_term(term: str, candidates: list[str]) -> bool:
    normalized = _normalize_term(term)
    for candidate in candidates:
        candidate_normalized = _normalize_term(candidate)
        if normalized == candidate_normalized:
            return True
        if len(normalized) >= 6 and len(candidate_normalized) >= 6:
            if normalized[:6] == candidate_normalized[:6]:
                return True
            if SequenceMatcher(None, normalized, candidate_normalized).ratio() >= 0.84:
                return True
    return False


def _normalize_term(term: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "", term.lower())
    suffixes = (
        "ments",
        "ment",
        "ations",
        "ation",
        "ingly",
        "ings",
        "ing",
        "edly",
        "ed",
        "ions",
        "ion",
        "ies",
        "es",
        "s",
    )
    for suffix in suffixes:
        if len(normalized) - len(suffix) >= 5 and normalized.endswith(suffix):
            if suffix == "ies":
                return normalized[: -len(suffix)] + "y"
            return normalized[: -len(suffix)]
    return normalized


def _normalize_string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


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
