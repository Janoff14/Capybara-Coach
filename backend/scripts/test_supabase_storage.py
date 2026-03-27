from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.services.storage import remove_object, upload_bytes


def main() -> int:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        print("Missing Supabase storage configuration.")
        return 1

    bucket_payloads = [
        (settings.supabase_audio_bucket, "audio/wav", b"storage-audio-smoke-test"),
        (settings.supabase_documents_bucket, "text/plain", b"storage-document-smoke-test"),
    ]

    failures = 0
    for bucket_name, content_type, payload in bucket_payloads:
        object_path = f"tests/{uuid4()}.txt"
        try:
            upload_bytes(
                settings=settings,
                bucket=bucket_name,
                object_path=object_path,
                payload=payload,
                content_type=content_type,
            )
            print(f"{bucket_name}: upload OK -> {object_path}")
            remove_object(settings=settings, bucket=bucket_name, object_path=object_path)
            print(f"{bucket_name}: cleanup OK -> {object_path}")
        except Exception as exc:
            failures += 1
            print(f"{bucket_name}: upload FAILED -> {exc}")

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
