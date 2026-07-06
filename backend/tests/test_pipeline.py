import json
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
                    "strictness": 72,
                    "protocol_version": 3,
                    "verdict": "Strong recall with one missing layer of detail.",
                    "criteria": {
                        "coverage": 90,
                        "accuracy": 92,
                        "clarity": 89,
                        "structure": 88,
                        "depth": 80,
                    },
                    "rubric": {
                        "coverage": "solid",
                        "accuracy": "solid",
                        "clarity": "solid",
                        "structure": "solid",
                        "depth": "partial",
                    },
                    "score_protocol": {
                        "base_score": 88,
                        "strictness_factor": 0.72,
                        "raw_penalty": 6,
                        "penalty_points": 4,
                        "penalty_breakdown": {
                            "missing": 4,
                            "weak_areas": 2,
                            "inaccuracies": 0,
                        },
                        "weights": {
                            "coverage": 0.28,
                            "accuracy": 0.30,
                            "clarity": 0.16,
                            "structure": 0.12,
                            "depth": 0.14,
                        },
                        "score": 91,
                    },
                    "covered_well": ["Defines inertia well"],
                    "missing": ["Could state the role of net force more explicitly"],
                    "weak_areas": ["Structure gets slightly compressed near the end"],
                    "inaccuracies": [],
                    "next_steps": ["Add one concrete example of the law in action"],
                    "accuracy": 92,
                    "coverage": 90,
                    "clarity": 89,
                    "examples": 80,
                    "structure": 88,
                    "depth": 80,
                    "feedback": "Accurate explanation with clear wording.",
                    "strengths": ["Defines inertia well"],
                    "gaps": ["Could add a concrete example"],
                },
            ) as assess_transcript_mock,
            patch(
                "app.api.routes.sessions.generate_recall_hint",
                return_value={
                    "state": "hint",
                    "prompt_type": "recall",
                    "message": "You have not defined inertia yet.",
                    "missing_concepts": ["inertia"],
                    "transcript_excerpt": "Objects keep moving.",
                    "transcript_so_far": "Objects keep moving. A force changes motion.",
                    "source": "ai",
                    "debug_reason": None,
                },
            ) as generate_recall_hint_mock,
            patch(
                "app.api.routes.sessions.generate_notes",
                return_value={
                    "title": "Newton's First Law",
                    "summary": "A short clean summary of inertia.",
                    "content": "Objects resist changes to their motion unless a net force acts.",
                },
            ) as generate_notes_mock,
            patch(
                "app.api.routes.sessions.generate_flashcards",
                return_value=[
                    {
                        "question": "What does Newton's first law say?",
                        "answer": "Objects stay at rest or in uniform motion unless a net force acts on them.",
                        "cue": "State the law cleanly.",
                        "card_type": "definition",
                        "source_focus": "Newton's first law",
                    },
                    {
                        "question": "What role does net force play?",
                        "answer": "A net force changes an object's state of motion.",
                        "cue": "Think about what changes motion.",
                        "card_type": "concept",
                        "source_focus": "net force",
                    },
                ],
            ) as generate_flashcards_mock,
            patch(
                "app.api.routes.sessions.generate_capture_study_set",
                return_value={
                    "note": {
                        "title": "My Newton Notes",
                        "summary": "My captured explanation of inertia.",
                        "content": "Inertia preserves an object's state of motion.",
                        "key_takeaways": ["Inertia preserves motion."],
                        "review_questions": ["What does inertia preserve?"],
                        "sections": [],
                        "source_mode": "typed_capture",
                    },
                    "cards": [
                        {
                            "question": "What does inertia preserve?",
                            "answer": "An object's state of motion.",
                            "cue": "Think motion",
                            "card_type": "concept",
                            "source_focus": "Inertia",
                        }
                    ],
                },
            ) as generate_capture_mock,
            patch(
                "app.api.routes.reviews.assess_flashcard_practice",
                return_value={
                    "protocol_version": 1,
                    "score": 88,
                    "rating": "easy",
                    "summary": "Accurate, concise recall across the full deck.",
                    "strengths": ["Both core ideas were recalled accurately."],
                    "improvements": ["Keep the net-force wording precise."],
                    "per_card": [],
                },
            ) as assess_flashcard_practice_mock,
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
            self.assertEqual(document["progress_percent"], 0)

            progress_response = self.client.put(
                f"/documents/{document['id']}/progress",
                headers=headers,
                json={"page": 99},
            )
            self.assertEqual(progress_response.status_code, 200)
            self.assertEqual(progress_response.json()["last_read_page"], 1)
            self.assertEqual(progress_response.json()["progress_percent"], 100)

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
                data={"strictness": "50", "cumulative_transcript": "Objects keep moving."},
            )
            self.assertEqual(hint_response.status_code, 200)
            self.assertEqual(hint_response.json()["state"], "hint")
            self.assertIn("inertia", hint_response.json()["message"])
            self.assertEqual(hint_response.json()["source"], "ai")
            self.assertIn("A force changes motion", hint_response.json()["transcript_so_far"])
            self.assertIn(
                "Objects keep moving. An object keeps its state of motion unless a force changes it.",
                generate_recall_hint_mock.call_args.kwargs["transcript_so_far"],
            )

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
                f"/sessions/{study_session['id']}/assess?strictness=72",
                headers=headers,
            )
            self.assertEqual(assess_response.status_code, 200)
            self.assertEqual(assess_response.json()["assessment_score"], 91)
            self.assertEqual(
                assess_response.json()["assessment_json"]["strictness"],
                72,
            )
            self.assertEqual(
                assess_response.json()["assessment_json"]["criteria"]["structure"],
                88,
            )
            self.assertEqual(
                assess_response.json()["assessment_json"]["protocol_version"],
                3,
            )
            self.assertEqual(assess_transcript_mock.call_count, 1)

            cached_assess_response = self.client.post(
                f"/sessions/{study_session['id']}/assess?strictness=72",
                headers=headers,
            )
            self.assertEqual(cached_assess_response.status_code, 200)
            self.assertEqual(cached_assess_response.json()["assessment_score"], 91)
            self.assertEqual(assess_transcript_mock.call_count, 1)

            stricter_assess_response = self.client.post(
                f"/sessions/{study_session['id']}/assess?strictness=90",
                headers=headers,
            )
            self.assertEqual(stricter_assess_response.status_code, 200)
            self.assertEqual(assess_transcript_mock.call_count, 2)

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

            flashcards_response = self.client.post(
                f"/sessions/{study_session['id']}/flashcards",
                headers=headers,
            )
            self.assertEqual(flashcards_response.status_code, 200)
            self.assertEqual(len(flashcards_response.json()), 2)
            self.assertEqual(
                flashcards_response.json()[0]["document_title"],
                "physics",
            )

            repeated_flashcards_response = self.client.post(
                f"/sessions/{study_session['id']}/flashcards",
                headers=headers,
            )
            self.assertEqual(repeated_flashcards_response.status_code, 200)
            self.assertEqual(len(repeated_flashcards_response.json()), 2)

            note_recall_response = self.client.post(
                "/sessions/from-note",
                headers=headers,
                json={"note_id": final_session["note"]["id"]},
            )
            self.assertEqual(note_recall_response.status_code, 201)
            note_recall_session = note_recall_response.json()
            self.assertEqual(
                note_recall_session["source_note_id"],
                final_session["note"]["id"],
            )
            self.assertEqual(note_recall_session["status"], "reading_complete")

            note_hint_response = self.client.post(
                f"/sessions/{note_recall_session['id']}/recall-hint",
                headers=headers,
                files={"file": ("note-hint.wav", b"fake-audio", "audio/wav")},
                data={"strictness": "50", "cumulative_transcript": "Objects keep moving."},
            )
            self.assertEqual(note_hint_response.status_code, 200)
            self.assertIn(
                "Objects resist changes to their motion",
                generate_recall_hint_mock.call_args.kwargs["source_text"],
            )
            self.assertEqual(
                generate_recall_hint_mock.call_args.kwargs["document_title"],
                "Newton's First Law",
            )
            self.assertIsNone(generate_recall_hint_mock.call_args.kwargs["reader_guide"])

            note_audio_response = self.client.post(
                f"/sessions/{note_recall_session['id']}/audio",
                headers=headers,
                files={"file": ("note-recall.wav", b"fake-audio", "audio/wav")},
            )
            self.assertEqual(note_audio_response.status_code, 200)
            self.assertEqual(
                self.client.post(
                    f"/sessions/{note_recall_session['id']}/transcribe",
                    headers=headers,
                ).status_code,
                200,
            )
            note_assess_response = self.client.post(
                f"/sessions/{note_recall_session['id']}/assess?strictness=50",
                headers=headers,
            )
            self.assertEqual(note_assess_response.status_code, 200)
            self.assertIn(
                "Objects resist changes to their motion",
                assess_transcript_mock.call_args.kwargs["source_text"],
            )
            self.assertEqual(
                self.client.post(
                    f"/sessions/{note_recall_session['id']}/notes",
                    headers=headers,
                ).status_code,
                400,
            )
            self.assertEqual(
                self.client.post(
                    f"/sessions/{note_recall_session['id']}/flashcards",
                    headers=headers,
                ).status_code,
                400,
            )

            reviews_response = self.client.get("/reviews", headers=headers)
            self.assertEqual(reviews_response.status_code, 200)
            self.assertEqual(len(reviews_response.json()), 1)
            self.assertTrue(reviews_response.json()[0]["is_due"])
            self.assertEqual(reviews_response.json()[0]["current_interval_days"], 1)

            flashcards_list_response = self.client.get("/flashcards", headers=headers)
            self.assertEqual(flashcards_list_response.status_code, 200)
            self.assertEqual(len(flashcards_list_response.json()), 2)

            filtered_flashcards_response = self.client.get(
                f"/flashcards?session_id={study_session['id']}",
                headers=headers,
            )
            self.assertEqual(filtered_flashcards_response.status_code, 200)
            self.assertEqual(len(filtered_flashcards_response.json()), 2)

            grade_review_response = self.client.post(
                f"/reviews/{study_session['id']}/grade",
                headers=headers,
                json={"rating": "easy"},
            )
            self.assertEqual(grade_review_response.status_code, 200)
            self.assertEqual(grade_review_response.json()["last_rating"], "easy")
            self.assertEqual(grade_review_response.json()["current_interval_days"], 7)
            self.assertFalse(grade_review_response.json()["is_due"])

            incomplete_attempt_response = self.client.post(
                f"/reviews/{study_session['id']}/attempts",
                headers=headers,
                json={
                    "answers": [
                        {
                            "flashcard_id": flashcards_response.json()[0]["id"],
                            "answer": "Objects keep their motion unless force changes it.",
                            "elapsed_seconds": 22,
                        }
                    ],
                    "active_seconds": 22,
                    "paused_seconds": 0,
                },
            )
            self.assertEqual(incomplete_attempt_response.status_code, 400)

            complete_attempt_response = self.client.post(
                f"/reviews/{study_session['id']}/attempts",
                headers=headers,
                json={
                    "answers": [
                        {
                            "flashcard_id": flashcards_response.json()[0]["id"],
                            "answer": "Objects keep their state of motion unless a net force acts.",
                            "elapsed_seconds": 22,
                        },
                        {
                            "flashcard_id": flashcards_response.json()[1]["id"],
                            "answer": "A net force changes the object's motion.",
                            "elapsed_seconds": 15,
                        },
                    ],
                    "active_seconds": 37,
                    "paused_seconds": 9,
                },
            )
            self.assertEqual(complete_attempt_response.status_code, 200)
            self.assertEqual(complete_attempt_response.json()["score"], 88)
            self.assertEqual(complete_attempt_response.json()["rating"], "easy")
            self.assertEqual(complete_attempt_response.json()["active_seconds"], 37)
            self.assertEqual(complete_attempt_response.json()["paused_seconds"], 9)
            self.assertEqual(complete_attempt_response.json()["schedule"]["last_rating"], "easy")
            self.assertEqual(complete_attempt_response.json()["schedule"]["completed_reviews"], 2)
            self.assertEqual(complete_attempt_response.json()["schedule"]["current_interval_days"], 30)
            self.assertEqual(
                assess_flashcard_practice_mock.call_args.kwargs["answers"][0]["expected_answer"],
                flashcards_response.json()[0]["answer"],
            )

            typed_session_response = self.client.post(
                "/sessions",
                headers=headers,
                json={"document_id": document["id"]},
            )
            self.assertEqual(typed_session_response.status_code, 201)
            typed_session = typed_session_response.json()
            typed_chunks = [
                {
                    "id": "material-1",
                    "content": "Inertia preserves an object's state of motion.",
                    "category": "study_material",
                    "created_at": "2026-07-02T08:00:00Z",
                },
                {
                    "id": "note-1",
                    "content": "Connect this to the bus example from class.",
                    "category": "note_only",
                    "created_at": "2026-07-02T08:01:00Z",
                },
                {
                    "id": "direction-1",
                    "content": "Keep the final note especially concise.",
                    "category": "ai_direction",
                    "created_at": "2026-07-02T08:02:00Z",
                },
            ]
            capture_response = self.client.put(
                f"/sessions/{typed_session['id']}/typed-capture",
                headers=headers,
                json={"chunks": typed_chunks},
            )
            self.assertEqual(capture_response.status_code, 200)
            capture_payload = capture_response.json()
            self.assertEqual(capture_payload["status"], "capturing_notes")
            self.assertEqual(capture_payload["transcript_provider"], "typed-capture-v1")
            self.assertEqual(
                json.loads(capture_payload["transcript_text"])["chunks"][1]["category"],
                "note_only",
            )

            invalid_capture_response = self.client.put(
                f"/sessions/{typed_session['id']}/typed-capture",
                headers=headers,
                json={
                    "chunks": [
                        {
                            **typed_chunks[0],
                            "content": "   ",
                        }
                    ]
                },
            )
            self.assertEqual(invalid_capture_response.status_code, 422)

            typed_assess_response = self.client.post(
                f"/sessions/{typed_session['id']}/assess",
                headers=headers,
            )
            self.assertEqual(typed_assess_response.status_code, 400)
            assessment_call_count = assess_transcript_mock.call_count

            typed_results_response = self.client.post(
                f"/sessions/{typed_session['id']}/typed-results",
                headers=headers,
            )
            self.assertEqual(typed_results_response.status_code, 200)
            typed_result = typed_results_response.json()
            self.assertEqual(typed_result["status"], "notes_ready")
            self.assertIsNone(typed_result["assessment_json"])
            self.assertEqual(typed_result["note"]["note_json"]["source_mode"], "typed_capture")
            self.assertEqual(assess_transcript_mock.call_count, assessment_call_count)
            self.assertEqual(
                generate_capture_mock.call_args.kwargs["study_material"],
                ["Inertia preserves an object's state of motion."],
            )
            self.assertEqual(
                generate_capture_mock.call_args.kwargs["note_only"],
                ["Connect this to the bus example from class."],
            )
            self.assertEqual(
                generate_capture_mock.call_args.kwargs["processing_instructions"],
                ["Keep the final note especially concise."],
            )
            self.assertNotIn(
                "source_text",
                generate_capture_mock.call_args.kwargs,
            )
            typed_cards_response = self.client.get(
                f"/flashcards?session_id={typed_session['id']}",
                headers=headers,
            )
            self.assertEqual(len(typed_cards_response.json()), 1)

            repeated_typed_results_response = self.client.post(
                f"/sessions/{typed_session['id']}/typed-results",
                headers=headers,
            )
            self.assertEqual(repeated_typed_results_response.status_code, 200)
            self.assertEqual(
                len(
                    self.client.get(
                        f"/flashcards?session_id={typed_session['id']}",
                        headers=headers,
                    ).json()
                ),
                1,
            )
            self.assertEqual(
                len(
                    [
                        review
                        for review in self.client.get("/reviews", headers=headers).json()
                        if review["study_session_id"] == typed_session["id"]
                    ]
                ),
                1,
            )

            changed_capture_response = self.client.put(
                f"/sessions/{typed_session['id']}/typed-capture",
                headers=headers,
                json={
                    "chunks": [
                        {
                            **typed_chunks[0],
                            "content": "A changed explanation should invalidate generated results.",
                        }
                    ]
                },
            )
            self.assertEqual(changed_capture_response.status_code, 200)
            self.assertEqual(
                self.client.get(
                    f"/flashcards?session_id={typed_session['id']}",
                    headers=headers,
                ).json(),
                [],
            )
            self.assertFalse(
                any(
                    review["study_session_id"] == typed_session["id"]
                    for review in self.client.get("/reviews", headers=headers).json()
                )
            )

            note_only_session = self.client.post(
                "/sessions",
                headers=headers,
                json={"document_id": document["id"]},
            ).json()
            note_only_chunk = {
                "id": "private-note-1",
                "content": "Remember the professor's demonstration.",
                "category": "note_only",
                "created_at": "2026-07-02T08:03:00Z",
            }
            self.assertEqual(
                self.client.put(
                    f"/sessions/{note_only_session['id']}/typed-capture",
                    headers=headers,
                    json={"chunks": [note_only_chunk]},
                ).status_code,
                200,
            )
            note_only_results_response = self.client.post(
                f"/sessions/{note_only_session['id']}/typed-results",
                headers=headers,
            )
            self.assertEqual(note_only_results_response.status_code, 200)
            note_only_cards_response = self.client.get(
                f"/flashcards?session_id={note_only_session['id']}",
                headers=headers,
            )
            self.assertEqual(note_only_cards_response.json(), [])

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

        local_response = self.client.options(
            "/auth/login",
            headers={
                "Origin": "http://127.0.0.1:3000",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        self.assertEqual(local_response.status_code, 200)
        self.assertEqual(
            local_response.headers["access-control-allow-origin"],
            "http://127.0.0.1:3000",
        )

    def test_auth_rejects_invalid_credentials_and_tokens(self) -> None:
        email = f"auth-{uuid4().hex}@example.com"
        password = "test-password"
        register_response = self.client.post(
            "/auth/register",
            json={"email": email, "password": password, "display_name": "Auth Test"},
        )
        self.assertEqual(register_response.status_code, 201)

        invalid_login_response = self.client.post(
            "/auth/login",
            json={"email": email, "password": "wrong-password"},
        )
        self.assertEqual(invalid_login_response.status_code, 401)
        self.assertEqual(
            invalid_login_response.json()["detail"],
            "Invalid email or password.",
        )

        invalid_token_response = self.client.get(
            "/auth/me",
            headers={"Authorization": "Bearer not-a-valid-token"},
        )
        self.assertEqual(invalid_token_response.status_code, 401)
        self.assertEqual(
            invalid_token_response.headers["www-authenticate"],
            "Bearer",
        )

    def test_cors_rejects_unapproved_origins(self) -> None:
        response = self.client.options(
            "/auth/login",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
