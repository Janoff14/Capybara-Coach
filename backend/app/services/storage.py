import re
from pathlib import Path

from supabase import Client, create_client

from app.core.config import Settings


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(filename).name).strip(".-")
    return cleaned or "file.bin"


def build_object_path(*parts: str) -> str:
    normalized = [part.strip("/") for part in parts if part]
    return "/".join(normalized)


def _create_client(settings: Settings) -> Client:
    if not settings.supabase_url or not settings.supabase_key:
        raise RuntimeError(
            "Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_KEY "
            "or SUPABASE_SERVICE_ROLE_KEY."
        )
    return create_client(settings.supabase_url, settings.supabase_key)


def _filesystem_object_path(
    *,
    settings: Settings,
    bucket: str,
    object_path: str,
) -> Path:
    root = settings.storage_dir.resolve()
    target = (root / sanitize_filename(bucket) / object_path).resolve()
    try:
        target.relative_to(root)
    except ValueError as exc:
        raise RuntimeError("Storage path escapes the configured storage directory.") from exc
    return target


def upload_bytes(
    *,
    settings: Settings,
    bucket: str,
    object_path: str,
    payload: bytes,
    content_type: str | None,
) -> str:
    if settings.uses_filesystem_storage:
        target = _filesystem_object_path(
            settings=settings,
            bucket=bucket,
            object_path=object_path,
        )
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return object_path

    client = _create_client(settings)
    options = {"upsert": "false"}
    if content_type:
        options["content-type"] = content_type
    client.storage.from_(bucket).upload(object_path, payload, options)
    return object_path


def download_bytes(*, settings: Settings, bucket: str, object_path: str) -> bytes:
    if settings.uses_filesystem_storage:
        target = _filesystem_object_path(
            settings=settings,
            bucket=bucket,
            object_path=object_path,
        )
        try:
            return target.read_bytes()
        except FileNotFoundError as exc:
            raise RuntimeError("Stored file was not found.") from exc

    client = _create_client(settings)
    payload = client.storage.from_(bucket).download(object_path)
    if isinstance(payload, bytes):
        return payload
    raise RuntimeError("Supabase download did not return file bytes.")


def remove_object(*, settings: Settings, bucket: str, object_path: str) -> None:
    if settings.uses_filesystem_storage:
        target = _filesystem_object_path(
            settings=settings,
            bucket=bucket,
            object_path=object_path,
        )
        target.unlink(missing_ok=True)
        return

    client = _create_client(settings)
    client.storage.from_(bucket).remove([object_path])
