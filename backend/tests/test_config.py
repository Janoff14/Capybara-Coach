import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from pydantic import ValidationError

from app.core.config import Settings
from app.services.storage import download_bytes, remove_object, upload_bytes


class ProductionConfigTests(unittest.TestCase):
    def test_production_rejects_ephemeral_database_and_default_secret(self) -> None:
        with self.assertRaisesRegex(ValidationError, "persistent PostgreSQL"):
            Settings(
                _env_file=None,
                environment="production",
                database_url="sqlite:///./capybara_coach.db",
                jwt_secret_key="change-me-in-production",
                supabase_url="https://example.supabase.co",
                supabase_key="test-key",
            )

    def test_production_accepts_persistent_database_and_strong_secret(self) -> None:
        settings = Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql://user:password@db.example.com:5432/app",
            jwt_secret_key="a-unique-production-secret-that-is-long-enough",
            supabase_url="https://example.supabase.co",
            supabase_key="test-key",
        )

        self.assertEqual(settings.environment, "production")

    def test_production_accepts_persistent_filesystem_storage(self) -> None:
        settings = Settings(
            _env_file=None,
            environment="production",
            database_url="postgresql://user:password@db.example.com:5432/app",
            jwt_secret_key="a-unique-production-secret-that-is-long-enough",
            storage_backend="filesystem",
            storage_dir="/data",
            supabase_url=None,
            supabase_key=None,
        )

        self.assertTrue(settings.uses_filesystem_storage)


class FilesystemStorageTests(unittest.TestCase):
    def test_upload_download_and_remove_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings = Settings(
                _env_file=None,
                storage_backend="filesystem",
                storage_dir=Path(temporary_directory),
            )
            object_path = "users/student/documents/lesson.pdf"

            upload_bytes(
                settings=settings,
                bucket="documents",
                object_path=object_path,
                payload=b"pdf-bytes",
                content_type="application/pdf",
            )

            self.assertEqual(
                download_bytes(
                    settings=settings,
                    bucket="documents",
                    object_path=object_path,
                ),
                b"pdf-bytes",
            )

            remove_object(
                settings=settings,
                bucket="documents",
                object_path=object_path,
            )
            with self.assertRaisesRegex(RuntimeError, "not found"):
                download_bytes(
                    settings=settings,
                    bucket="documents",
                    object_path=object_path,
                )


class RemoteStorageErrorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.settings = Settings(
            _env_file=None,
            storage_backend="supabase",
            supabase_url="https://example.supabase.co",
            supabase_key="test-key",
        )

    def test_client_initialization_error_is_safe_and_actionable(self) -> None:
        with patch("app.services.storage.create_client", side_effect=OSError("provider details")):
            with self.assertRaisesRegex(RuntimeError, "could not be initialized"):
                upload_bytes(
                    settings=self.settings,
                    bucket="documents",
                    object_path="users/student/lesson.pdf",
                    payload=b"pdf-bytes",
                    content_type="application/pdf",
                )

    def test_provider_operation_errors_are_wrapped(self) -> None:
        client = MagicMock()
        bucket = client.storage.from_.return_value
        operations = (
            (
                "upload",
                bucket.upload,
                lambda: upload_bytes(
                    settings=self.settings,
                    bucket="documents",
                    object_path="users/student/lesson.pdf",
                    payload=b"pdf-bytes",
                    content_type="application/pdf",
                ),
                "could not be uploaded",
            ),
            (
                "download",
                bucket.download,
                lambda: download_bytes(
                    settings=self.settings,
                    bucket="documents",
                    object_path="users/student/lesson.pdf",
                ),
                "could not be downloaded",
            ),
            (
                "remove",
                bucket.remove,
                lambda: remove_object(
                    settings=self.settings,
                    bucket="documents",
                    object_path="users/student/lesson.pdf",
                ),
                "could not be removed",
            ),
        )

        with patch("app.services.storage._create_client", return_value=client):
            for name, provider_method, operation, message in operations:
                with self.subTest(operation=name):
                    provider_method.side_effect = OSError("provider details")
                    with self.assertRaisesRegex(RuntimeError, message):
                        operation()
                    provider_method.reset_mock(side_effect=True)


if __name__ == "__main__":
    unittest.main()
