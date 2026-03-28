from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    original_filename: str
    content_type: str | None
    source_type: str
    storage_bucket: str
    storage_path: str
    extracted_text: str
    reader_json: dict | None
    page_count: int
    created_at: datetime
    updated_at: datetime
