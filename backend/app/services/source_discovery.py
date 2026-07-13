from __future__ import annotations

import json
import re
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import Settings
from app.services.ai import _chat_json, _dedupe_strings, _parse_json_payload, _string_list

OPENALEX_WORKS_URL = "https://api.openalex.org/works"
REQUEST_TIMEOUT_SECONDS = 8


def suggest_reading_sources(
    *,
    topic: str,
    source_text: str | None,
    limit: int,
    settings: Settings,
) -> list[dict[str, Any]]:
    queries = _source_search_queries(
        topic=topic,
        source_text=source_text or "",
        settings=settings,
    )
    suggestions: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for query in queries:
        for work in _fetch_openalex_works(query=query, per_page=limit):
            suggestion = _normalize_openalex_work(work, query=query)
            if suggestion is None:
                continue
            url_key = suggestion["url"].lower()
            if url_key in seen_urls:
                continue
            seen_urls.add(url_key)
            suggestions.append(suggestion)
            if len(suggestions) >= limit:
                return suggestions

    return suggestions


def _source_search_queries(*, topic: str, source_text: str, settings: Settings) -> list[str]:
    fallback = _fallback_source_queries(topic=topic, source_text=source_text)
    if not settings.azure_openai_endpoint or not settings.azure_openai_api_key:
        return fallback

    prompt = f"""
Create concise scholarly search queries for finding additional reading sources.

Topic:
{topic}

Source excerpt:
{source_text[:5000]}

Return JSON only with:
- queries: 3 to 5 strings

Rules:
- Prefer conceptual searches over exact document titles.
- Keep each query under 10 words.
- Avoid author names unless they are essential to the topic.
- The queries should help a student find useful papers, books, or reviews.
"""
    try:
        content = _chat_json(
            settings=settings,
            system_prompt="You create focused search queries for student reading recommendations.",
            user_prompt=prompt,
            temperature=0,
        )
        payload = _parse_json_payload(content)
        queries = _dedupe_strings(_string_list(payload.get("queries")))
        priority_query = _normalize_query(topic) or fallback[0]
        return _dedupe_strings([priority_query, *queries, *fallback])[:5] or fallback
    except Exception:
        return fallback


def _fallback_source_queries(*, topic: str, source_text: str) -> list[str]:
    phrases = _important_phrases(source_text)
    candidates = [*phrases, topic.strip()] if source_text.strip() else [topic.strip()]
    cleaned = [
        _normalize_query(candidate)
        for candidate in candidates
        if _normalize_query(candidate)
    ]
    return _dedupe_strings(cleaned)[:5] or ["study skills"]


def _important_phrases(source_text: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z'-]{3,}", source_text)
    stop_words = {
        "about", "after", "also", "because", "before", "being", "between", "could",
        "during", "each", "from", "have", "into", "more", "most", "other", "should",
        "such", "than", "that", "their", "there", "these", "this", "through", "using",
        "when", "where", "which", "while", "with", "would",
    }
    counts: dict[str, int] = {}
    first_seen: dict[str, int] = {}
    for index, word in enumerate(words):
        key = word.lower().strip("'")
        if key in stop_words:
            continue
        counts[key] = counts.get(key, 0) + 1
        first_seen.setdefault(key, index)

    ranked = sorted(counts.items(), key=lambda item: (-item[1], first_seen[item[0]]))
    phrases: list[str] = []
    for index in range(0, min(len(ranked), 8), 2):
        phrase = " ".join(word for word, _ in ranked[index : index + 2])
        if phrase:
            phrases.append(phrase)
    return phrases


def _normalize_query(value: str) -> str:
    query = re.sub(r"\s+", " ", value).strip(" .,:;")
    words = query.split()
    return " ".join(words[:10])


def _fetch_openalex_works(*, query: str, per_page: int) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "search": query,
            "filter": "is_retracted:false,has_abstract:true",
            "sort": "relevance_score:desc",
            "per-page": max(1, min(10, per_page)),
        }
    )
    request = Request(
        f"{OPENALEX_WORKS_URL}?{params}",
        headers={
            "Accept": "application/json",
            "User-Agent": "CapybaraCoach/0.1 (source discovery)",
        },
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))

    results = payload.get("results") if isinstance(payload, dict) else None
    if not isinstance(results, list):
        return []
    return [item for item in results if isinstance(item, dict)]


def _normalize_openalex_work(work: dict[str, Any], *, query: str) -> dict[str, Any] | None:
    title = str(work.get("display_name") or work.get("title") or "").strip()
    url = _work_url(work)
    if not title or not url:
        return None

    open_access = work.get("open_access") if isinstance(work.get("open_access"), dict) else {}
    primary_location = (
        work.get("primary_location") if isinstance(work.get("primary_location"), dict) else {}
    )
    source = (
        primary_location.get("source")
        if isinstance(primary_location.get("source"), dict)
        else {}
    )
    authorships = work.get("authorships") if isinstance(work.get("authorships"), list) else []
    authors = [
        str(author.get("display_name")).strip()
        for item in authorships[:4]
        if isinstance(item, dict)
        for author in [item.get("author")]
        if isinstance(author, dict) and str(author.get("display_name") or "").strip()
    ]

    abstract = _abstract_from_inverted_index(work.get("abstract_inverted_index"))
    source_name = str(source.get("display_name") or "").strip() or None
    source_type = str(work.get("type") or "work").strip() or "work"
    cited_by_count = _coerce_int(work.get("cited_by_count"))
    is_open_access = bool(open_access.get("is_oa"))
    open_access_url = str(open_access.get("oa_url") or "").strip() or None

    return {
        "id": str(work.get("id") or url),
        "title": title,
        "authors": authors,
        "year": _coerce_optional_int(work.get("publication_year")),
        "source_name": source_name,
        "source_type": source_type,
        "url": url,
        "doi": str(work.get("doi") or "").strip() or None,
        "abstract": abstract,
        "is_open_access": is_open_access,
        "open_access_url": open_access_url,
        "cited_by_count": cited_by_count,
        "reason": _suggestion_reason(
            source_type=source_type,
            source_name=source_name,
            cited_by_count=cited_by_count,
            is_open_access=is_open_access,
        ),
        "query": query,
    }


def _work_url(work: dict[str, Any]) -> str:
    open_access = work.get("open_access") if isinstance(work.get("open_access"), dict) else {}
    primary_location = (
        work.get("primary_location") if isinstance(work.get("primary_location"), dict) else {}
    )
    candidates = [
        open_access.get("oa_url"),
        primary_location.get("landing_page_url"),
        work.get("doi"),
        work.get("id"),
    ]
    for candidate in candidates:
        url = str(candidate or "").strip()
        if url.startswith("http://") or url.startswith("https://"):
            return url
    return ""


def _abstract_from_inverted_index(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None

    positions: dict[int, str] = {}
    for word, indexes in value.items():
        if not isinstance(indexes, list):
            continue
        for index in indexes:
            try:
                positions[int(index)] = str(word)
            except (TypeError, ValueError):
                continue

    if not positions:
        return None

    abstract = " ".join(positions[index] for index in sorted(positions))
    return abstract[:900].strip() or None


def _suggestion_reason(
    *,
    source_type: str,
    source_name: str | None,
    cited_by_count: int,
    is_open_access: bool,
) -> str:
    parts = [f"{source_type.replace('-', ' ')}"]
    if source_name:
        parts.append(f"from {source_name}")
    if cited_by_count > 0:
        parts.append(f"cited {cited_by_count} times")
    if is_open_access:
        parts.append("open access")
    return "; ".join(parts).capitalize() + "."


def _coerce_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _coerce_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
