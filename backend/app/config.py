from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Capybara Coach API"
    environment: str = "development"
    database_url: str = "sqlite:///./capybara_coach.db"
    storage_dir: Path = Path("./storage")
    demo_user_id: str = "demo-user"
    demo_user_email: str = "student@capybaracoach.local"
    demo_user_name: str = "Demo Student"
    stt_provider: str = "auto"
    stt_base_url: str | None = None
    stt_api_key: str | None = None
    stt_model: str = "gpt-4o-mini-transcribe"
    stt_timeout_seconds: float = 300.0
    faster_whisper_model: str = "small"
    faster_whisper_device: str = "cpu"
    faster_whisper_compute_type: str = "int8"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_timeout_seconds: float = 60.0
    api_poll_interval_seconds: int = Field(default=2, ge=1)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    (settings.storage_dir / "audio").mkdir(parents=True, exist_ok=True)
    return settings
