from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DocumentProgressUpdate(BaseModel):
    page: int = Field(ge=1)


class DocumentProgressRead(BaseModel):
    last_read_page: int
    progress_percent: int
    updated_at: datetime


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
    last_read_page: int = 0
    progress_percent: int = 0
    created_at: datetime
    updated_at: datetime
