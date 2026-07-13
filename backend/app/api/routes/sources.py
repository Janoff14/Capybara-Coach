from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.source import SourceSuggestionRead, SourceSuggestionRequest
from app.services.auth import get_current_user
from app.services.source_discovery import suggest_reading_sources

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("/suggestions", response_model=list[SourceSuggestionRead])
def suggest_sources(
    payload: SourceSuggestionRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    document: Document | None = None
    if payload.document_id:
        document = db.scalars(
            select(Document).where(
                Document.id == payload.document_id,
                Document.user_id == current_user.id,
            )
        ).one_or_none()
        if document is None:
            raise HTTPException(status_code=404, detail="Document not found.")

    topic = (payload.topic or "").strip()
    return suggest_reading_sources(
        topic=topic,
        source_text=document.extracted_text if document is not None else None,
        limit=payload.limit,
        settings=settings,
    )
