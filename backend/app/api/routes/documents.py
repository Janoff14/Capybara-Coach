from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentRead
from app.services.pdf import extract_text_from_payload
from app.services.storage import build_object_path, sanitize_filename, upload_bytes
from app.services.users import get_or_create_default_user

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead])
def list_documents(db: Session = Depends(get_db)) -> list[Document]:
    statement = select(Document).order_by(Document.created_at.desc())
    return list(db.scalars(statement))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(document_id: str, db: Session = Depends(get_db)) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Document:
    user = get_or_create_default_user(db, settings)
    filename = file.filename or "document.pdf"
    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded document is empty.")

    try:
        extracted_text, source_type, page_count = extract_text_from_payload(filename, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    object_path = build_object_path(
        "users",
        user.id,
        "documents",
        f"{uuid4()}-{sanitize_filename(filename)}",
    )

    try:
        upload_bytes(
            settings=settings,
            bucket=settings.supabase_documents_bucket,
            object_path=object_path,
            payload=payload,
            content_type=file.content_type,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    document = Document(
        user_id=user.id,
        title=title or Path(filename).stem or "Untitled document",
        original_filename=filename,
        content_type=file.content_type,
        source_type=source_type,
        storage_bucket=settings.supabase_documents_bucket,
        storage_path=object_path,
        extracted_text=extracted_text,
        page_count=page_count,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document
