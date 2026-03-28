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
