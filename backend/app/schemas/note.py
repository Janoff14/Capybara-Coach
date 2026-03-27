from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    summary: str
    content: str
    note_json: dict | None
    created_at: datetime
    updated_at: datetime
