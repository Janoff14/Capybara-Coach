import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_TEMP_DIR = Path(tempfile.mkdtemp(prefix="capybara-coach-tests-")).resolve()
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEMP_DIR / 'study_flow.db').as_posix()}"
os.environ["STORAGE_DIR"] = str((_TEMP_DIR / "storage").resolve())
os.environ["LLM_API_KEY"] = ""
os.environ["LLM_MODEL"] = ""

from fastapi.testclient import TestClient

from app.db import Base, engine
from app.main import app


class StudyFlowApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        Base.metadata.drop_all(bind=engine)

    def setUp(self) -> None:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

    def test_document_session_evaluation_and_note_generation(self) -> None:
        source_text = (
            "TCP establishes a connection with a three-way handshake and provides reliable, "
            "ordered delivery with retransmission of lost packets.\n\n"
            "HTTP is a stateless application-layer protocol where a request includes a method, "
            "path, headers, and an optional body.\n\n"
            "DNS translates domain names into IP addresses, while routers forward packets "
            "between networks by consulting routing tables."
        )

        import_response = self.client.post(
            "/documents/import",
            data={
                "title": "Networking Basics",
                "subtitle": "Core internet concepts",
                "raw_text": source_text,
            },
        )
        self.assertEqual(import_response.status_code, 200)
        imported_document = import_response.json()
        self.assertEqual(imported_document["title"], "Networking Basics")
        self.assertGreaterEqual(imported_document["section_count"], 1)

        section_id = imported_document["sections"][0]["id"]
        document_id = imported_document["id"]

        documents_response = self.client.get("/documents")
        self.assertEqual(documents_response.status_code, 200)
        self.assertEqual(len(documents_response.json()), 1)

        session_response = self.client.post(
            "/sessions",
            json={
                "document_id": document_id,
                "section_id": section_id,
                "mode": "assisted",
            },
        )
        self.assertEqual(session_response.status_code, 200)
        created_session = session_response.json()
        self.assertEqual(created_session["status"], "reading")

        recall_response = self.client.post(
            f"/sessions/{created_session['id']}/evaluate",
            json={
                "recall_transcript": (
                    "TCP uses a three-way handshake to establish a reliable ordered connection "
                    "and retransmit lost packets when delivery fails."
                ),
                "actual_read_seconds": 240,
            },
        )
        self.assertEqual(recall_response.status_code, 200)
        evaluated_session = recall_response.json()
        self.assertEqual(evaluated_session["status"], "feedback_ready")
        self.assertGreaterEqual(evaluated_session["score_total"], 70)
        self.assertTrue(evaluated_session["passed_threshold"])

        note_response = self.client.post(f"/sessions/{created_session['id']}/generate-note")
        self.assertEqual(note_response.status_code, 200)
        note_bundle = note_response.json()
        self.assertEqual(note_bundle["session"]["status"], "complete")
        self.assertEqual(note_bundle["note"]["processing_status"], "ready")
        self.assertTrue(note_bundle["note"]["title"])
        self.assertTrue(note_bundle["note"]["tags"])

        note_id = note_bundle["note"]["id"]
        fetched_note_response = self.client.get(f"/notes/{note_id}")
        self.assertEqual(fetched_note_response.status_code, 200)
        fetched_note = fetched_note_response.json()
        self.assertEqual(fetched_note["id"], note_id)
        self.assertTrue(fetched_note["cleaned_content"])
        self.assertIn("TCP", fetched_note["cleaned_content"])

        sessions_response = self.client.get("/sessions")
        self.assertEqual(sessions_response.status_code, 200)
        self.assertEqual(len(sessions_response.json()), 1)

        folders_response = self.client.get("/folders")
        self.assertEqual(folders_response.status_code, 200)
        self.assertEqual(len(folders_response.json()), 1)

    def test_audio_evaluation_endpoint_updates_session(self) -> None:
        source_text = (
            "Caching stores expensive results so repeated requests can be served faster. "
            "A cache hit returns stored data, while a cache miss requires recomputation."
        )

        import_response = self.client.post(
            "/documents/import",
            data={
                "title": "Caching Basics",
                "subtitle": "Performance review",
                "raw_text": source_text,
            },
        )
        imported_document = import_response.json()

        session_response = self.client.post(
            "/sessions",
            json={
                "document_id": imported_document["id"],
                "section_id": imported_document["sections"][0]["id"],
                "mode": "assisted",
            },
        )
        created_session = session_response.json()

        with patch(
            "app.main.transcribe_file",
            return_value={
                "text": (
                    "Caching stores expensive results so repeated requests are faster. "
                    "A cache hit returns stored data and a cache miss recomputes it."
                ),
                "language_code": "en",
                "provider": "faster-whisper",
                "segments": [],
            },
        ):
            evaluation_response = self.client.post(
                f"/sessions/{created_session['id']}/evaluate-audio",
                files={"audio": ("attempt.m4a", b"fake-audio", "audio/mp4")},
                data={"actual_read_seconds": "180"},
            )

        self.assertEqual(evaluation_response.status_code, 200)
        evaluated_session = evaluation_response.json()
        self.assertEqual(evaluated_session["status"], "feedback_ready")
        self.assertEqual(
            evaluated_session["recall_transcript"],
            "Caching stores expensive results so repeated requests are faster. "
            "A cache hit returns stored data and a cache miss recomputes it.",
        )
        self.assertEqual(evaluated_session["actual_read_seconds"], 180)
        self.assertGreaterEqual(evaluated_session["score_total"], 70)


if __name__ == "__main__":
    unittest.main()
