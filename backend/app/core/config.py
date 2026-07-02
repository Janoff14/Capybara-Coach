from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Capybara Coach API"
    environment: str = "development"
    database_url: str = "sqlite:///./capybara_coach.db"
    storage_dir: Path = Path("./storage")
    storage_backend: str = "supabase"
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_allowed_origin_regex: str = r"https://.*\.vercel\.app"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7

    supabase_url: str | None = None
    supabase_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"),
    )
    supabase_documents_bucket: str = "documents"
    supabase_audio_bucket: str = "audio"

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AZURE_OPENAI_API_KEY", "OPENAI_API_KEY"),
    )
    azure_openai_api_version: str = "2024-02-01"
    azure_openai_stt_deployment: str = "gpt-4o-mini-transcribe"
    azure_openai_text_deployment: str = "gpt-4.1-mini"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment.strip().lower() != "production":
            return self

        problems: list[str] = []
        if self.database_url.startswith("sqlite"):
            problems.append("DATABASE_URL must use persistent PostgreSQL")
        if self.jwt_secret_key == "change-me-in-production" or len(self.jwt_secret_key) < 32:
            problems.append("JWT_SECRET_KEY must be a unique secret of at least 32 characters")
        storage_backend = self.storage_backend.strip().lower()
        if storage_backend not in {"supabase", "filesystem"}:
            problems.append("STORAGE_BACKEND must be 'supabase' or 'filesystem'")
        if storage_backend == "supabase" and (not self.supabase_url or not self.supabase_key):
            problems.append("Supabase storage credentials are required")

        if problems:
            raise ValueError("Invalid production configuration: " + "; ".join(problems))

        return self

    @property
    def uses_filesystem_storage(self) -> bool:
        return self.storage_backend.strip().lower() == "filesystem"

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]

    @property
    def cors_origin_regex(self) -> str | None:
        candidate = self.cors_allowed_origin_regex.strip()
        return candidate or None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings
