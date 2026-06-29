import unittest

from pydantic import ValidationError

from app.core.config import Settings


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


if __name__ == "__main__":
    unittest.main()
