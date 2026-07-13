import unittest
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from app.core.config import Settings
from app.services.source_discovery import (
    _fetch_openalex_works,
    _source_search_queries,
    suggest_reading_sources,
)


class SourceDiscoveryTests(unittest.TestCase):
    def test_suggest_reading_sources_normalizes_openalex_results(self) -> None:
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )
        works = [
            {
                "id": "https://openalex.org/W1",
                "display_name": "Retrieval Practice and Durable Learning",
                "publication_year": 2024,
                "type": "article",
                "doi": "https://doi.org/10.123/example",
                "cited_by_count": 42,
                "open_access": {"is_oa": True, "oa_url": "https://example.org/paper.pdf"},
                "primary_location": {
                    "landing_page_url": "https://example.org/landing",
                    "source": {"display_name": "Journal of Learning"},
                },
                "authorships": [
                    {"author": {"display_name": "Ada Scholar"}},
                    {"author": {"display_name": "Ben Researcher"}},
                ],
                "abstract_inverted_index": {
                    "Retrieval": [0],
                    "practice": [1],
                    "supports": [2],
                    "retention": [3],
                },
            }
        ]

        with patch(
            "app.services.source_discovery._fetch_openalex_works",
            return_value=works,
        ) as fetch_works:
            suggestions = suggest_reading_sources(
                topic="retrieval practice",
                source_text="Retrieval practice improves memory through effortful recall.",
                limit=3,
                settings=settings,
            )

        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["title"], "Retrieval Practice and Durable Learning")
        self.assertEqual(suggestions[0]["authors"], ["Ada Scholar", "Ben Researcher"])
        self.assertEqual(suggestions[0]["url"], "https://example.org/paper.pdf")
        self.assertEqual(suggestions[0]["abstract"], "Retrieval practice supports retention")
        self.assertTrue(suggestions[0]["is_open_access"])
        fetch_works.assert_called()

    def test_suggest_reading_sources_deduplicates_urls(self) -> None:
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )
        works = [
            {
                "id": "https://openalex.org/W1",
                "display_name": "One",
                "open_access": {"is_oa": False},
                "primary_location": {"landing_page_url": "https://example.org/source"},
            },
            {
                "id": "https://openalex.org/W2",
                "display_name": "Duplicate",
                "open_access": {"is_oa": False},
                "primary_location": {"landing_page_url": "https://example.org/source"},
            },
        ]

        with patch("app.services.source_discovery._fetch_openalex_works", return_value=works):
            suggestions = suggest_reading_sources(
                topic="learning",
                source_text=None,
                limit=5,
                settings=settings,
            )

        self.assertEqual(len(suggestions), 1)
        self.assertEqual(suggestions[0]["title"], "One")

    def test_openalex_fetch_prefers_relevance_over_citation_sorting(self) -> None:
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *_: object) -> None:
                return None

            def read(self) -> bytes:
                return b'{"results":[]}'

        captured_urls: list[str] = []

        def fake_urlopen(request, timeout: int):
            captured_urls.append(request.full_url)
            return FakeResponse()

        with patch("app.services.source_discovery.urlopen", side_effect=fake_urlopen):
            self.assertEqual(_fetch_openalex_works(query="retrieval practice", per_page=3), [])

        params = parse_qs(urlparse(captured_urls[0]).query)
        self.assertEqual(params["sort"], ["relevance_score:desc"])
        self.assertNotEqual(params["sort"], ["cited_by_count:desc"])

    def test_ai_queries_keep_user_topic_first(self) -> None:
        settings = Settings(
            azure_openai_endpoint="https://example.cognitiveservices.azure.com",
            azure_openai_api_key="test-key",
            storage_backend="filesystem",
        )

        with (
            patch(
                "app.services.source_discovery._chat_json",
                return_value='{"queries":["memory retrieval learning","student study strategies"]}',
            ),
            patch(
                "app.services.source_discovery._parse_json_payload",
                return_value={"queries": ["memory retrieval learning", "student study strategies"]},
            ),
        ):
            queries = _source_search_queries(
                topic="retrieval practice learning",
                source_text="Retrieval practice improves learning.",
                settings=settings,
            )

        self.assertEqual(queries[0], "retrieval practice learning")
        self.assertIn("memory retrieval learning", queries)

    def test_fallback_queries_prefer_document_text_when_available(self) -> None:
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )

        queries = _source_search_queries(
            topic="Retrieval Practice Visual Test",
            source_text=(
                "Retrieval practice improves durable learning. "
                "Retrieval practice uses spaced recall for memory."
            ),
            settings=settings,
        )

        self.assertEqual(queries[0], "retrieval practice")
        self.assertIn("Retrieval Practice Visual Test", queries)

    def test_empty_topic_can_use_document_text(self) -> None:
        settings = Settings(
            azure_openai_endpoint=None,
            azure_openai_api_key=None,
            storage_backend="filesystem",
        )

        queries = _source_search_queries(
            topic="",
            source_text="Spaced repetition and retrieval practice improve long-term retention.",
            settings=settings,
        )

        self.assertEqual(queries[0], "spaced repetition")
        self.assertNotIn("", queries)


if __name__ == "__main__":
    unittest.main()
