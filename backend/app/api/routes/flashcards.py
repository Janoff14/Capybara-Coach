from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.flashcard import Flashcard
from app.models.study_session import StudySession
from app.models.user import User
from app.schemas.flashcard import FlashcardRead
from app.services.auth import get_current_user

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


@router.get("", response_model=list[FlashcardRead])
def list_flashcards(
    session_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FlashcardRead]:
    statement = (
        select(Flashcard)
        .options(
            joinedload(Flashcard.study_session).joinedload(StudySession.document),
        )
        .where(Flashcard.user_id == current_user.id)
        .order_by(Flashcard.created_at.desc(), Flashcard.order_index.asc())
    )

    if session_id:
        statement = statement.where(Flashcard.study_session_id == session_id)

    cards = list(db.scalars(statement).unique())
    return [_serialize_flashcard(card) for card in cards]


def _serialize_flashcard(card: Flashcard) -> FlashcardRead:
    return FlashcardRead.model_validate(
        {
            "id": card.id,
            "study_session_id": card.study_session_id,
            "note_id": card.note_id,
            "document_id": card.study_session.document_id,
            "document_title": card.study_session.document.title,
            "order_index": card.order_index,
            "question": card.question,
            "answer": card.answer,
            "cue": card.cue,
            "card_type": card.card_type,
            "source_focus": card.source_focus,
            "created_at": card.created_at,
            "updated_at": card.updated_at,
        }
    )
