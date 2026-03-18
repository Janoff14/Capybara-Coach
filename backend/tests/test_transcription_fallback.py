import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

_TEMP_DIR = Path(tempfile.mkdtemp(prefix="capybara-coach-stt-tests-")).resolve()
os.environ["DATABASE_URL"] = f"sqlite:///{(_TEMP_DIR / 'stt.db').as_posix()}"
os.environ["STORAGE_DIR"] = str((_TEMP_DIR / "storage").resolve())

from app.pipeline import transcribe_file


class TranscriptionFallbackTests(unittest.TestCase):
    def test_auto_provider_falls_back_to_remote_stt(self) -> None:
        settings = SimpleNamespace(
            stt_provider="auto",
            stt_api_key="test-key",
            llm_api_key="",
            stt_base_url="https://api.openai.com/v1",
            llm_base_url="https://api.openai.com/v1",
            stt_model="gpt-4o-mini-transcribe",
            stt_timeout_seconds=300.0,
        )

        with (
            patch(
                "app.pipeline._transcribe_with_faster_whisper",
                side_effect=RuntimeError("Local faster-whisper transcription is unavailable."),
            ),
            patch(
                "app.pipeline._transcribe_with_openai",
                return_value={
                    "text": "Remote fallback transcript",
                    "language_code": "en",
                    "provider": "gpt-4o-mini-transcribe",
                    "segments": [],
                },
            ) as remote_transcribe,
        ):
            result = transcribe_file("fake-audio.m4a", settings)

        self.assertEqual(result["text"], "Remote fallback transcript")
        remote_transcribe.assert_called_once_with("fake-audio.m4a", settings)

    def test_auto_provider_without_remote_credentials_raises_clear_error(self) -> None:
        settings = SimpleNamespace(
            stt_provider="auto",
            stt_api_key="",
            llm_api_key="",
            stt_base_url="https://api.openai.com/v1",
            llm_base_url="https://api.openai.com/v1",
            stt_model="gpt-4o-mini-transcribe",
            stt_timeout_seconds=300.0,
        )

        with patch(
            "app.pipeline._transcribe_with_faster_whisper",
            side_effect=RuntimeError("Local faster-whisper transcription is unavailable."),
        ):
            with self.assertRaises(RuntimeError) as exc:
                transcribe_file("fake-audio.m4a", settings)

        self.assertIn("No remote STT fallback is configured", str(exc.exception))


if __name__ == "__main__":
    unittest.main()
