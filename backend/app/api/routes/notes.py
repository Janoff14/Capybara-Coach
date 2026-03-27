from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteRead
from app.services.auth import get_current_user

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
def list_notes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Note]:
    statement = (
        select(Note)
        .where(Note.user_id == current_user.id)
        .order_by(Note.created_at.desc())
    )
    return list(db.scalars(statement))


@router.get("/{note_id}", response_model=NoteRead)
def get_note(
    note_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Note:
    statement = select(Note).where(Note.id == note_id, Note.user_id == current_user.id)
    note = db.scalars(statement).one_or_none()
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found.")
    return note
