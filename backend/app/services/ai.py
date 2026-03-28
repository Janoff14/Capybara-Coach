from __future__ import annotations

import json
import re
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from openai import AzureOpenAI

from app.core.config import Settings


def _create_client(settings: Settings) -> AzureOpenAI:
    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        raise RuntimeError(
            "Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT and "
            "AZURE_OPENAI_API_KEY (or OPENAI_API_KEY)."
        )

    return AzureOpenAI(
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        azure_endpoint=settings.azure_openai_endpoint.rstrip("/"),
    )


def transcribe_audio(*, filename: str, payload: bytes, settings: Settings) -> dict[str, Any]:
    client = _create_client(settings)
    suffix = Path(filename).suffix or ".wav"

    with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(payload)
        temp_path = Path(temp_file.name)

    try:
        with temp_path.open("rb") as audio_file:
            result = client.audio.transcriptions.create(
                model=settings.azure_openai_stt_deployment,
                file=audio_file,
            )
    finally:
        temp_path.unlink(missing_ok=True)

    return {
        "text": (getattr(result, "text", "") or "").strip(),
        "provider": settings.azure_openai_stt_deployment,
        "language": getattr(result, "language", None) or "en",
    }


def assess_transcript(
    *,
    transcript: str,
    source_text: str,
    settings: Settings,
) -> dict[str, Any]:
    prompt = f"""
Compare the student's explanation to the source.

Source:
{source_text}

Student:
{transcript}

Score out of 100 based on:
- accuracy
- coverage
- clarity
- examples

Return JSON only with these keys:
- score
- accuracy
- coverage
- clarity
- examples
- feedback
- strengths
- gaps
"""

    content = _chat_json(
        settings=settings,
        system_prompt="You are a strict evaluator for study recall.",
        user_prompt=prompt,
    )
    payload = _parse_json_payload(content)
    return {
        "score": _coerce_score(payload.get("score")),
        "accuracy": _coerce_score(payload.get("accuracy")),
        "coverage": _coerce_score(payload.get("coverage")),
        "clarity": _coerce_score(payload.get("clarity")),
        "examples": _coerce_score(payload.get("examples")),
        "feedback": str(payload.get("feedback") or "No feedback returned."),
        "strengths": _string_list(payload.get("strengths")),
        "gaps": _string_list(payload.get("gaps")),
    }


def generate_reader_guide(
    *,
    document_title: str,
    source_text: str,
    settings: Settings,
) -> dict[str, Any]:
    fallback = _build_reader_guide_fallback(source_text)

    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        return fallback

    clipped_source = source_text.strip()[:14000]
    prompt = f"""
Create a guided reading companion for this study document.

Document title:
{document_title}

Source:
{clipped_source}

Return JSON only with these keys:
- key_terms
- important_sentences
- sections

Rules:
- "key_terms" should be 4 to 8 objects with:
  - term
  - definition
- "important_sentences" should be 4 to 8 concise, high-value sentences from the source.
- "sections" should be an array of objects with:
  - heading
  - summary_bullets
  - highlights
- Each "summary_bullets" list should contain 2 to 4 bullets.
- Each "highlights" list should contain up to 4 objects with:
  - type (key_idea, definition, example)
  - text
- Keep everything concise, readable, and useful for active studying.
"""

    try:
        content = _chat_json(
            settings=settings,
            system_prompt=(
                "You prepare reading guides that help learners focus on important ideas"
                " without over-explaining the whole document."
            ),
            user_prompt=prompt,
        )
        payload = _parse_json_payload(content)
        return _normalize_reader_guide(payload, fallback)
    except Exception:
        return fallback


def generate_notes(
    *,
    transcript: str,
    source_text: str,
    assessment: dict[str, Any],
    document_title: str,
    settings: Settings,
) -> dict[str, Any]:
    prompt = f"""
Create polished, highly readable study notes from the student's transcript, the original source, and the assessment.

Document title:
{document_title}

Source:
{source_text}

Transcript:
{transcript}

Assessment:
{json.dumps(assessment, ensure_ascii=False)}

Return JSON only with these keys:
- title
- summary
- content
- key_takeaways
- review_questions
- sections

Formatting requirements:
- Make the notes easy to scan and pleasant to read.
- Prefer short sections with strong headings instead of one long wall of text.
- Correct factual mistakes from the transcript using the source.
- Use concrete bullets when they improve clarity.
- "content" should be markdown-like plain text with section headings and bullets.
- "key_takeaways" should be 3 to 5 concise points.
- "review_questions" should be 3 to 5 short study questions.
- "sections" should be an array of objects with:
  - heading
  - body
  - bullets
"""

    content = _chat_json(
        settings=settings,
        system_prompt=(
            "You turn transcripts into polished, corrected study notes that feel"
            " editorial, structured, and easy to review."
        ),
        user_prompt=prompt,
    )
    payload = _parse_json_payload(content)
    sections = _note_sections(payload.get("sections"))
    key_takeaways = _string_list(payload.get("key_takeaways"))
    review_questions = _string_list(payload.get("review_questions"))
    summary = str(
        payload.get("summary") or "Clean notes generated from the study session."
    ).strip()
    note_content = str(payload.get("content") or "").strip()

    if not note_content:
        note_content = _compose_note_content(
            summary=summary,
            sections=sections,
            key_takeaways=key_takeaways,
            review_questions=review_questions,
            fallback=transcript,
        )

    if not key_takeaways:
        key_takeaways = [section["heading"] for section in sections[:4] if section["heading"]]

    return {
        "title": str(payload.get("title") or f"{document_title} notes"),
        "summary": summary,
        "content": note_content,
        "key_takeaways": key_takeaways,
        "review_questions": review_questions,
        "sections": sections,
    }


def _normalize_reader_guide(
    payload: dict[str, Any],
    fallback: dict[str, Any],
) -> dict[str, Any]:
    fallback_sections = _reader_sections(fallback.get("sections"))
    payload_sections = _reader_sections(payload.get("sections"))
    merged_sections: list[dict[str, Any]] = []

    if payload_sections:
        for index, fallback_section in enumerate(fallback_sections):
            payload_section = payload_sections[index] if index < len(payload_sections) else {}
            summary_bullets = _string_list(payload_section.get("summary_bullets"))
            highlights = _reader_highlights(payload_section.get("highlights"))

            merged_sections.append(
                {
                    "heading": str(
                        payload_section.get("heading") or fallback_section.get("heading") or ""
                    ).strip()
                    or fallback_section.get("heading")
                    or f"Section {index + 1}",
                    "summary_bullets": summary_bullets
                    or _string_list(fallback_section.get("summary_bullets")),
                    "highlights": highlights
                    or _reader_highlights(fallback_section.get("highlights")),
                }
            )
    else:
        merged_sections = fallback_sections

    key_terms = _reader_terms(payload.get("key_terms"))
    important_sentences = _string_list(payload.get("important_sentences"))

    return {
        "key_terms": key_terms or _reader_terms(fallback.get("key_terms")),
        "important_sentences": important_sentences
        or _string_list(fallback.get("important_sentences")),
        "sections": merged_sections or fallback_sections,
    }


def _chat_json(*, settings: Settings, system_prompt: str, user_prompt: str) -> str:
    client = _create_client(settings)
    response = client.chat.completions.create(
        model=settings.azure_openai_text_deployment,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
    )
    return _content_to_text(response.choices[0].message.content)


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            text_value = None
            if isinstance(item, dict):
                text_value = item.get("text")
            else:
                text_value = getattr(item, "text", None)
            if isinstance(text_value, str):
                parts.append(text_value)
            elif text_value is not None:
                parts.append(str(getattr(text_value, "value", "") or ""))
        return "".join(parts)
    return str(content or "")


def _parse_json_payload(content: str) -> dict[str, Any]:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if not match:
            raise RuntimeError("The model did not return valid JSON.")
        payload = json.loads(match.group(0))

    if not isinstance(payload, dict):
        raise RuntimeError("The model response was not a JSON object.")
    return payload


def _coerce_score(value: Any) -> int:
    try:
        numeric = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, numeric))


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _reader_terms(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    terms: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        term = str(item.get("term") or "").strip()
        definition = str(item.get("definition") or "").strip()
        if not term or not definition:
            continue

        terms.append({"term": term, "definition": definition})

    return terms[:8]


def _reader_highlights(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []

    highlights: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        highlight_type = str(item.get("type") or "").strip().lower()
        text = str(item.get("text") or "").strip()
        if highlight_type not in {"key_idea", "definition", "example"} or not text:
            continue

        highlights.append({"type": highlight_type, "text": text})

    return highlights[:6]


def _reader_sections(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    sections: list[dict[str, Any]] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            continue

        heading = str(item.get("heading") or item.get("title") or "").strip()
        summary_bullets = _string_list(item.get("summary_bullets"))
        highlights = _reader_highlights(item.get("highlights"))

        if not heading and not summary_bullets and not highlights:
            continue

        sections.append(
            {
                "heading": heading or f"Section {index}",
                "summary_bullets": summary_bullets[:4],
                "highlights": highlights,
            }
        )

    return sections


def _note_sections(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []

    sections: list[dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue

        heading = str(item.get("heading") or item.get("title") or "").strip()
        body = str(item.get("body") or item.get("content") or "").strip()
        bullets = _string_list(item.get("bullets"))

        if not heading and not body and not bullets:
            continue

        sections.append(
            {
                "heading": heading or "Key idea",
                "body": body,
                "bullets": bullets,
            }
        )

    return sections


def _compose_note_content(
    *,
    summary: str,
    sections: list[dict[str, Any]],
    key_takeaways: list[str],
    review_questions: list[str],
    fallback: str,
) -> str:
    chunks: list[str] = []

    if summary:
        chunks.append("## Summary\n" + summary)

    if key_takeaways:
        chunks.append(
            "## Key Takeaways\n" + "\n".join(f"- {item}" for item in key_takeaways)
        )

    for index, section in enumerate(sections, start=1):
        section_lines = [f"## {index}. {section['heading']}"]
        if section["body"]:
            section_lines.append(str(section["body"]))
        if section["bullets"]:
            section_lines.extend(f"- {item}" for item in section["bullets"])
        chunks.append("\n".join(section_lines))

    if review_questions:
        chunks.append(
            "## Review Questions\n"
            + "\n".join(f"- {question}" for question in review_questions)
        )

    if not chunks:
        chunks.append(fallback.strip())

    return "\n\n".join(chunk for chunk in chunks if chunk.strip())


def _build_reader_guide_fallback(source_text: str) -> dict[str, Any]:
    paragraphs = _reader_paragraphs(source_text)
    sections = _heuristic_reader_sections(paragraphs)
    all_sentences = _top_sentences(paragraphs, limit=8)

    return {
        "key_terms": _heuristic_key_terms(paragraphs),
        "important_sentences": all_sentences,
        "sections": sections,
    }


def _reader_paragraphs(source_text: str) -> list[str]:
    return [
        block.replace("\n", " ").strip()
        for block in source_text.replace("\r\n", "\n").split("\n\n")
        if block.strip()
    ]


def _heuristic_reader_sections(paragraphs: list[str]) -> list[dict[str, Any]]:
    if not paragraphs:
        return []

    chunk_size = 2 if len(paragraphs) <= 6 else 3
    sections: list[dict[str, Any]] = []
    for index in range(0, len(paragraphs), chunk_size):
        chunk = paragraphs[index : index + chunk_size]
        section_number = len(sections) + 1
        heading = _derive_section_heading(chunk, section_number)
        summary_bullets = _top_sentences(chunk, limit=3)
        highlights = _heuristic_highlights(chunk)
        sections.append(
            {
                "heading": heading,
                "summary_bullets": summary_bullets,
                "highlights": highlights,
            }
        )

    return sections


def _derive_section_heading(paragraphs: list[str], section_number: int) -> str:
    first_sentence = _split_sentences(paragraphs[0])[0] if paragraphs else ""
    cleaned = re.sub(r"^[\d.\-)\s]+", "", first_sentence).strip()
    if cleaned:
        words = cleaned.split()
        return " ".join(words[:6]).rstrip(",:;") or f"Section {section_number}"
    return f"Section {section_number}"


def _heuristic_highlights(paragraphs: list[str]) -> list[dict[str, str]]:
    sentences = _top_sentences(paragraphs, limit=6)
    highlights: list[dict[str, str]] = []

    for sentence in sentences:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in (" is ", " refers to ", " means ", " defined as ")):
            highlights.append({"type": "definition", "text": sentence})
        elif any(keyword in lowered for keyword in ("for example", "for instance", "such as", "e.g.")):
            highlights.append({"type": "example", "text": sentence})
        else:
            highlights.append({"type": "key_idea", "text": sentence})

        if len(highlights) >= 4:
            break

    return highlights


def _heuristic_key_terms(paragraphs: list[str]) -> list[dict[str, str]]:
    candidates: list[dict[str, str]] = []

    for paragraph in paragraphs:
        for sentence in _split_sentences(paragraph):
            match = re.match(
                r"([A-Z][A-Za-z0-9'/-]*(?:\s+[A-Z][A-Za-z0-9'/-]*){0,3})\s+(?:is|are|refers to|means|describes)\s+(.+)",
                sentence,
            )
            if not match:
                continue

            term = match.group(1).strip(" .,:;")
            definition = match.group(2).strip(" .,:;")
            if term and definition:
                candidates.append({"term": term, "definition": definition})

    deduped: list[dict[str, str]] = []
    seen_terms: set[str] = set()
    for item in candidates:
        term_key = item["term"].lower()
        if term_key in seen_terms:
            continue
        seen_terms.add(term_key)
        deduped.append(item)
        if len(deduped) >= 6:
            break

    return deduped


def _top_sentences(paragraphs: list[str], limit: int) -> list[str]:
    sentences: list[str] = []
    for paragraph in paragraphs:
        for sentence in _split_sentences(paragraph):
            if len(sentence.split()) < 6:
                continue
            sentences.append(sentence)
            if len(sentences) >= limit:
                return sentences
    return sentences


def _split_sentences(value: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", value.strip())
    return [part.strip() for part in parts if part.strip()]
