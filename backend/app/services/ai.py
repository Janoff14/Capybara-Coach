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
- Prefer central concepts, mechanisms, and explanatory examples over isolated names, citations, dates, or footnotes.
- Do not highlight a sentence unless it would still matter to a student during recall.
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


def generate_recall_hint(
    *,
    transcript_so_far: str,
    latest_chunk: str,
    source_text: str,
    document_title: str,
    reader_guide: dict[str, Any] | None,
    strictness: int,
    settings: Settings,
) -> dict[str, Any]:
    fallback = _build_recall_hint_fallback(
        transcript_so_far=transcript_so_far,
        latest_chunk=latest_chunk,
        source_text=source_text,
        reader_guide=reader_guide,
    )

    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        fallback["debug_reason"] = "azure_not_configured"
        return fallback

    prompt = f"""
You are Capybara Coach, helping a student during live recall.

Document title:
{document_title}

Study guide:
{json.dumps(reader_guide or {}, ensure_ascii=False)[:5000]}

Source:
{source_text[:9000]}

Student recall so far:
{transcript_so_far[:7000]}

Latest spoken chunk:
{latest_chunk[:2500] or "[No new chunk detected]"}

Strictness:
{max(0, min(100, strictness))}/100

Return JSON only with these keys:
- state
- prompt_type
- message
- missing_concepts

Rules:
- "state" must be either "hint" or "encouraging".
- "prompt_type" must be one of: recall, depth, connection.
- "message" must be a short coaching bubble, max 18 words.
- "missing_concepts" should be 0 to 3 short strings.
- Do not dump the answer or restate the source verbatim.
- Base the hint on the cumulative recall so far, not only the latest chunk.
- Do not ask for concepts the student has already covered reasonably well.
- Give a hint only if the student clearly missed, skimmed, or weakly connected something important.
- If the student is doing reasonably well, prefer a short encouraging nudge.
- At low strictness, accept rough but correct understanding. At high strictness, push for missing precision.
- Sound warm, brief, and coach-like.
"""

    try:
        content = _chat_json(
            settings=settings,
            system_prompt=(
                "You are a calm live study coach. You give short, non-spammy hints"
                " only when the learner stalls or misses an important concept."
            ),
            user_prompt=prompt,
        )
        payload = _parse_json_payload(content)
        return _normalize_recall_hint(payload, fallback, transcript_so_far, latest_chunk)
    except Exception:
        fallback["debug_reason"] = "ai_hint_generation_failed"
        return fallback


def merge_recall_transcript(cumulative_transcript: str, latest_chunk: str) -> str:
    cumulative = _normalize_whitespace(cumulative_transcript)
    latest = _normalize_whitespace(latest_chunk)

    if not cumulative:
        return latest

    if not latest:
        return cumulative

    cumulative_lower = cumulative.lower()
    latest_lower = latest.lower()

    if latest_lower in cumulative_lower:
        return cumulative

    max_overlap = min(len(cumulative_lower), len(latest_lower), 240)
    for overlap in range(max_overlap, 23, -1):
        if cumulative_lower.endswith(latest_lower[:overlap]):
            return _normalize_whitespace(f"{cumulative}{latest[overlap:]}")

    return _normalize_whitespace(f"{cumulative} {latest}")


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


def _normalize_recall_hint(
    payload: dict[str, Any],
    fallback: dict[str, Any],
    transcript_so_far: str,
    latest_chunk: str,
) -> dict[str, Any]:
    state = str(payload.get("state") or fallback["state"]).strip().lower()
    if state not in {"hint", "encouraging"}:
        state = fallback["state"]

    prompt_type = str(payload.get("prompt_type") or fallback["prompt_type"]).strip().lower()
    if prompt_type not in {"recall", "depth", "connection"}:
        prompt_type = fallback["prompt_type"]

    message = str(payload.get("message") or fallback["message"]).strip()
    if not message:
        message = fallback["message"]

    if len(message.split()) > 18:
        message = " ".join(message.split()[:18]).strip()

    return {
        "state": state,
        "prompt_type": prompt_type,
        "message": message,
        "missing_concepts": _string_list(payload.get("missing_concepts"))[:3]
        or fallback["missing_concepts"],
        "transcript_excerpt": latest_chunk.strip()[:240],
        "transcript_so_far": transcript_so_far.strip()[:6000],
        "source": "ai",
        "debug_reason": None,
    }


def _build_reader_guide_fallback(source_text: str) -> dict[str, Any]:
    paragraphs = _reader_paragraphs(source_text)
    sections = _heuristic_reader_sections(paragraphs)
    all_sentences = _top_sentences(paragraphs, limit=8)

    return {
        "key_terms": _heuristic_key_terms(paragraphs),
        "important_sentences": all_sentences,
        "sections": sections,
    }


def _build_recall_hint_fallback(
    *,
    transcript_so_far: str,
    latest_chunk: str,
    source_text: str,
    reader_guide: dict[str, Any] | None,
) -> dict[str, Any]:
    lowered_transcript = transcript_so_far.lower()
    key_terms = _reader_terms((reader_guide or {}).get("key_terms"))
    sections = _reader_sections((reader_guide or {}).get("sections"))
    important_sentences = _string_list((reader_guide or {}).get("important_sentences"))

    missing_terms = [
        item["term"]
        for item in key_terms
        if item["term"].lower() not in lowered_transcript
    ]
    missing_sections = [
        section["heading"]
        for section in sections
        if section["heading"].lower() not in lowered_transcript
    ]

    if missing_terms:
        focus = missing_terms[0]
        return {
            "state": "hint",
            "prompt_type": "recall",
            "message": f"You have not named {focus} yet. Bring it into the explanation.",
            "missing_concepts": missing_terms[:3],
            "transcript_excerpt": latest_chunk.strip()[:240],
            "transcript_so_far": transcript_so_far.strip()[:6000],
            "source": "fallback",
            "debug_reason": None,
        }

    if missing_sections:
        focus = missing_sections[0]
        return {
            "state": "hint",
            "prompt_type": "connection",
            "message": f"Connect your explanation back to {focus}. Why does that section matter?",
            "missing_concepts": missing_sections[:3],
            "transcript_excerpt": latest_chunk.strip()[:240],
            "transcript_so_far": transcript_so_far.strip()[:6000],
            "source": "fallback",
            "debug_reason": None,
        }

    if important_sentences:
        return {
            "state": "encouraging",
            "prompt_type": "depth",
            "message": "Good start. Add one layer of why it matters, not just what it says.",
            "missing_concepts": [],
            "transcript_excerpt": latest_chunk.strip()[:240],
            "transcript_so_far": transcript_so_far.strip()[:6000],
            "source": "fallback",
            "debug_reason": None,
        }

    return {
        "state": "encouraging",
        "prompt_type": "recall",
        "message": "Keep going. Close with the key takeaway someone should remember.",
        "missing_concepts": _top_sentences(_reader_paragraphs(source_text), limit=2),
        "transcript_excerpt": latest_chunk.strip()[:240],
        "transcript_so_far": transcript_so_far.strip()[:6000],
        "source": "fallback",
        "debug_reason": None,
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


def _normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()
