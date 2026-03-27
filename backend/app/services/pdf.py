from io import BytesIO
from pathlib import Path

from pypdf import PdfReader


def extract_text_from_payload(filename: str, payload: bytes) -> tuple[str, str, int]:
    suffix = Path(filename).suffix.lower()
    if suffix == ".pdf":
        reader = PdfReader(BytesIO(payload))
        page_count = len(reader.pages)
        extracted_pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n\n".join(page for page in extracted_pages if page)
        if not text.strip():
            raise ValueError("The PDF did not contain readable text.")
        return text.strip(), "pdf", page_count

    for encoding in ("utf-8", "latin-1"):
        try:
            text = payload.decode(encoding)
            break
        except UnicodeDecodeError:
            text = ""

    if not text.strip():
        raise ValueError("Only readable text or PDF uploads are supported right now.")

    return text.strip(), "text", 1
