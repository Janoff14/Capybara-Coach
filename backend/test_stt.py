import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AzureOpenAI


def resolve_audio_path() -> Path:
    explicit_path = os.getenv("TEST_STT_AUDIO_PATH")
    if explicit_path:
        path = Path(explicit_path)
        if path.exists():
            return path
        raise FileNotFoundError(f"TEST_STT_AUDIO_PATH does not exist: {path}")

    for default_name in ("test_audio.mp3", "test_audio.wav"):
        default_path = Path(default_name)
        if default_path.exists():
            return default_path

    storage_audio_dir = Path("storage") / "audio"
    fallback_file = next(storage_audio_dir.glob("*"), None)
    if fallback_file is not None:
        return fallback_file

    raise FileNotFoundError(
        "No audio file found. Add test_audio.mp3 or set TEST_STT_AUDIO_PATH."
    )


def main() -> None:
    load_dotenv()

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    deployment = os.getenv("AZURE_OPENAI_STT_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if not endpoint or not api_key or not deployment:
        raise RuntimeError(
            "Missing Azure STT config. Set AZURE_OPENAI_ENDPOINT, "
            "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_STT_DEPLOYMENT."
        )

    client = AzureOpenAI(
        api_key=api_key,
        api_version=api_version,
        azure_endpoint=endpoint,
    )

    audio_path = resolve_audio_path()
    print(f"Using audio file: {audio_path}")

    with audio_path.open("rb") as audio:
        result = client.audio.transcriptions.create(
            file=audio,
            model=deployment,
        )

    print("\nTRANSCRIPT:\n")
    print(result.text)


if __name__ == "__main__":
    main()
