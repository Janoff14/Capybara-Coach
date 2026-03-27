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
Create clean study notes from the student's transcript, the original source, and the assessment.

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
"""

    content = _chat_json(
        settings=settings,
        system_prompt="You turn transcripts into concise, corrected study notes.",
        user_prompt=prompt,
    )
    payload = _parse_json_payload(content)
    return {
        "title": str(payload.get("title") or f"{document_title} notes"),
        "summary": str(payload.get("summary") or "Clean notes generated from the study session."),
        "content": str(payload.get("content") or transcript),
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
