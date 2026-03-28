import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

_TEMP_DIR = Path(tempfile.mkdtemp(prefix="capybara-coach-tests-")).resolve()
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEMP_DIR / 'pipeline.db').as_posix()}"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_KEY"] = "test-key"
os.environ["AZURE_OPENAI_ENDPOINT"] = "https://example.cognitiveservices.azure.com"
os.environ["AZURE_OPENAI_API_KEY"] = "test-key"

from fastapi.testclient import TestClient

from app.core.database import Base, engine
from app.main import app


def build_pdf_bytes(text: str) -> bytes:
    escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT\n/F1 12 Tf\n72 720 Td\n({escaped_text}) Tj\nET\n"
    objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            "3 0 obj\n"
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\n"
            "endobj\n"
        ),
        (
            f"4 0 obj\n<< /Length {len(stream.encode('latin-1'))} >>\nstream\n"
            f"{stream}endstream\nendobj\n"
        ),
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(pdf))
        pdf.extend(obj.encode("latin-1"))

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))

    trailer = (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n"
    )
    pdf.extend(trailer.encode("latin-1"))
    return bytes(pdf)


class PipelineApiTests(unittest.TestCase):
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
        self.storage: dict[tuple[str, str], bytes] = {}

    def _fake_upload(self, *, bucket: str, object_path: str, payload: bytes, **_: object) -> str:
        self.storage[(bucket, object_path)] = payload
        return object_path

    def _fake_download(self, *, bucket: str, object_path: str, **_: object) -> bytes:
        return self.storage[(bucket, object_path)]

    def _register(self) -> dict[str, str]:
        email = f"student-{uuid4().hex}@example.com"
        password = "test-password"
        response = self.client.post(
            "/auth/register",
            json={
                "email": email,
                "password": password,
                "display_name": "Pipeline Student",
            },
        )
        self.assertEqual(response.status_code, 201)
        login_response = self.client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        self.assertEqual(login_response.status_code, 200)
        payload = login_response.json()
        token = payload["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        return headers

    def test_full_pipeline(self) -> None:
        pdf_bytes = build_pdf_bytes(
            "Newton's first law says an object stays at rest or moves uniformly unless acted on by a force."
        )
        headers = self._register()

        with (
            patch("app.api.routes.documents.upload_bytes", side_effect=self._fake_upload),
            patch("app.api.routes.documents.download_bytes", side_effect=self._fake_download),
            patch(
                "app.api.routes.documents.generate_reader_guide",
                return_value={
                    "key_terms": [
                        {
                            "term": "Newton's first law",
                            "definition": "Objects keep their state of motion unless a force changes it.",
                        }
                    ],
                    "important_sentences": [
                        "Newton's first law says an object stays at rest or moves uniformly unless acted on by a force."
                    ],
                    "sections": [
                        {
                            "heading": "Core principle",
                            "summary_bullets": [
                                "Objects stay at rest or move uniformly without a net force."
                            ],
                            "highlights": [
                                {
                                    "type": "key_idea",
                                    "text": "Newton's first law says an object stays at rest or moves uniformly unless acted on by a force.",
                                }
                            ],
                        }
                    ],
                },
            ),
            patch("app.api.routes.sessions.upload_bytes", side_effect=self._fake_upload),
            patch("app.api.routes.sessions.download_bytes", side_effect=self._fake_download),
            patch(
                "app.api.routes.sessions.transcribe_audio",
                return_value={
                    "text": "An object keeps its state of motion unless a force changes it.",
                    "provider": "gpt-4o-mini-transcribe",
                    "language": "en",
                },
            ),
            patch(
                "app.api.routes.sessions.assess_transcript",
                return_value={
                    "score": 91,
                    "accuracy": 92,
                    "coverage": 90,
                    "clarity": 89,
                    "examples": 80,
                    "feedback": "Accurate explanation with clear wording.",
                    "strengths": ["Defines inertia well"],
                    "gaps": ["Could add a concrete example"],
                },
            ),
            patch(
                "app.api.routes.sessions.generate_recall_hint",
                return_value={
                    "state": "hint",
                    "prompt_type": "recall",
                    "message": "You have not defined inertia yet.",
                    "missing_concepts": ["inertia"],
                    "transcript_excerpt": "Objects keep moving.",
                },
            ),
            patch(
                "app.api.routes.sessions.generate_notes",
                return_value={
                    "title": "Newton's First Law",
                    "summary": "A short clean summary of inertia.",
                    "content": "Objects resist changes to their motion unless a net force acts.",
                },
            ),
        ):
            me_response = self.client.get("/auth/me", headers=headers)
            self.assertEqual(me_response.status_code, 200)
            self.assertEqual(me_response.json()["display_name"], "Pipeline Student")

            document_response = self.client.post(
                "/documents/upload",
                headers=headers,
                files={"file": ("physics.pdf", pdf_bytes, "application/pdf")},
            )
            self.assertEqual(document_response.status_code, 201)
            document = document_response.json()
            self.assertIn("Newton's first law", document["extracted_text"])
            self.assertEqual(document["reader_json"]["sections"][0]["heading"], "Core principle")

            document_file_response = self.client.get(
                f"/documents/{document['id']}/file",
                headers=headers,
            )
            self.assertEqual(document_file_response.status_code, 200)
            self.assertEqual(document_file_response.headers["content-type"], "application/pdf")
            self.assertTrue(document_file_response.content.startswith(b"%PDF-1.4"))

            session_response = self.client.post(
                "/sessions",
                headers=headers,
                json={"document_id": document["id"]},
            )
            self.assertEqual(session_response.status_code, 201)
            study_session = session_response.json()
            self.assertEqual(study_session["status"], "created")

            finish_response = self.client.post(
                f"/sessions/{study_session['id']}/finish-reading",
                headers=headers,
            )
            self.assertEqual(finish_response.status_code, 200)
            self.assertEqual(finish_response.json()["status"], "reading_complete")

            hint_response = self.client.post(
                f"/sessions/{study_session['id']}/recall-hint",
                headers=headers,
                files={"file": ("hint.wav", b"fake-audio", "audio/wav")},
                data={"strictness": "50"},
            )
            self.assertEqual(hint_response.status_code, 200)
            self.assertEqual(hint_response.json()["state"], "hint")
            self.assertIn("inertia", hint_response.json()["message"])

            audio_response = self.client.post(
                f"/sessions/{study_session['id']}/audio",
                headers=headers,
                files={"file": ("speech.wav", b"fake-audio", "audio/wav")},
            )
            self.assertEqual(audio_response.status_code, 200)
            self.assertEqual(audio_response.json()["status"], "audio_uploaded")

            transcribe_response = self.client.post(
                f"/sessions/{study_session['id']}/transcribe",
                headers=headers,
            )
            self.assertEqual(transcribe_response.status_code, 200)
            self.assertIn("force changes it", transcribe_response.json()["transcript_text"])

            assess_response = self.client.post(
                f"/sessions/{study_session['id']}/assess",
                headers=headers,
            )
            self.assertEqual(assess_response.status_code, 200)
            self.assertEqual(assess_response.json()["assessment_score"], 91)

            notes_response = self.client.post(
                f"/sessions/{study_session['id']}/notes",
                headers=headers,
            )
            self.assertEqual(notes_response.status_code, 200)
            final_session = notes_response.json()
            self.assertEqual(final_session["status"], "notes_ready")
            self.assertEqual(final_session["note"]["title"], "Newton's First Law")
            self.assertIn("Objects resist changes", final_session["note"]["content"])

            notes_list_response = self.client.get("/notes", headers=headers)
            self.assertEqual(notes_list_response.status_code, 200)
            self.assertEqual(len(notes_list_response.json()), 1)

            fetch_response = self.client.get(
                f"/sessions/{study_session['id']}",
                headers=headers,
            )
            self.assertEqual(fetch_response.status_code, 200)
            self.assertEqual(fetch_response.json()["assessment_feedback"], "Accurate explanation with clear wording.")

    def test_cors_allows_vercel_origins(self) -> None:
        response = self.client.options(
            "/auth/register",
            headers={
                "Origin": "https://capybara-coach-web.vercel.app",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["access-control-allow-origin"],
            "https://capybara-coach-web.vercel.app",
        )


if __name__ == "__main__":
    unittest.main()
