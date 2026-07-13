from pydantic import BaseModel, Field, model_validator


class SourceSuggestionRequest(BaseModel):
    topic: str | None = Field(default=None, max_length=240)
    document_id: str | None = None
    limit: int = Field(default=5, ge=1, le=10)

    @model_validator(mode="after")
    def require_topic_or_document(self) -> "SourceSuggestionRequest":
        if not (self.topic or "").strip() and not self.document_id:
            raise ValueError("Provide a topic or document_id.")
        return self


class SourceSuggestionRead(BaseModel):
    id: str
    title: str
    authors: list[str]
    year: int | None
    source_name: str | None
    source_type: str
    url: str
    doi: str | None
    abstract: str | None
    is_open_access: bool
    open_access_url: str | None
    cited_by_count: int
    reason: str
    query: str
