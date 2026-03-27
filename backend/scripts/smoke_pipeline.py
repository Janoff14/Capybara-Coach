from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import uuid4

from dotenv import load_dotenv
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


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


def reset_local_sqlite_db() -> None:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL", "sqlite:///./capybara_coach.db")
    if not database_url.startswith("sqlite:///"):
        return

    database_path = Path(database_url.removeprefix("sqlite:///"))
    if not database_path.is_absolute():
        database_path = Path.cwd() / database_path

    if database_path.exists():
        database_path.unlink()


def main() -> None:
    reset_local_sqlite_db()

    audio_path = Path("test_audio.wav")
    if not audio_path.exists():
        raise FileNotFoundError("test_audio.wav is required for the smoke pipeline.")

    from app.main import app

    pdf_bytes = build_pdf_bytes(
        "Newton's first law says an object stays at rest or in motion unless acted on by a force."
    )

    with TestClient(app) as client:
        email = f"smoke-{uuid4().hex}@example.com"
        password = "smoke-password"
        register_response = client.post(
            "/auth/register",
            json={
                "email": email,
                "password": password,
                "display_name": "Smoke Tester",
            },
        )
        register_response.raise_for_status()
        login_response = client.post(
            "/auth/login",
            json={"email": email, "password": password},
        )
        login_response.raise_for_status()
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        document_response = client.post(
            "/documents/upload",
            headers=headers,
            files={"file": ("physics.pdf", pdf_bytes, "application/pdf")},
        )
        document_response.raise_for_status()
        document = document_response.json()

        session_response = client.post(
            "/sessions",
            headers=headers,
            json={"document_id": document["id"]},
        )
        session_response.raise_for_status()
        study_session = session_response.json()

        finish_response = client.post(
            f"/sessions/{study_session['id']}/finish-reading",
            headers=headers,
        )
        finish_response.raise_for_status()

        with audio_path.open("rb") as audio_file:
            audio_response = client.post(
                f"/sessions/{study_session['id']}/audio",
                headers=headers,
                files={"file": (audio_path.name, audio_file.read(), "audio/wav")},
            )
        audio_response.raise_for_status()

        transcribe_response = client.post(
            f"/sessions/{study_session['id']}/transcribe",
            headers=headers,
        )
        transcribe_response.raise_for_status()

        assess_response = client.post(
            f"/sessions/{study_session['id']}/assess",
            headers=headers,
        )
        assess_response.raise_for_status()

        notes_response = client.post(
            f"/sessions/{study_session['id']}/notes",
            headers=headers,
        )
        notes_response.raise_for_status()
        final_session = notes_response.json()

        notes_response = client.get("/notes", headers=headers)
        notes_response.raise_for_status()
        notes = notes_response.json()

    print("Document uploaded:", document["id"])
    print("Session created:", study_session["id"])
    print("Transcript:", final_session["transcript_text"])
    print("Score:", final_session["assessment_score"])
    print("Note title:", final_session["note"]["title"] if final_session["note"] else "missing")
    print("Notes count:", len(notes))


if __name__ == "__main__":
    main()
