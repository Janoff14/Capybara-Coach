from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentRead
from app.services.ai import generate_reader_guide
from app.services.auth import get_current_user
from app.services.pdf import extract_text_from_payload
from app.services.storage import build_object_path, download_bytes, sanitize_filename, upload_bytes

router = APIRouter(prefix="/documents", tags=["documents"])


def _get_document_or_404(db: Session, document_id: str, user_id: str) -> Document:
    statement = select(Document).where(
        Document.id == document_id,
        Document.user_id == user_id,
    )
    document = db.scalars(statement).one_or_none()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document


@router.get("", response_model=list[DocumentRead])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Document]:
    statement = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    return list(db.scalars(statement))


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    return _get_document_or_404(db, document_id, current_user.id)


@router.get("/{document_id}/file")
def get_document_file(
    document_id: str,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> Response:
    document = _get_document_or_404(db, document_id, current_user.id)
    try:
        payload = download_bytes(
            settings=settings,
            bucket=document.storage_bucket,
            object_path=document.storage_path,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    filename = sanitize_filename(document.original_filename or f"{document.id}.pdf")
    return Response(
        content=payload,
        media_type=document.content_type or "application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> Document:
    filename = file.filename or "document.pdf"
    payload = file.file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Uploaded document is empty.")

    try:
        extracted_text, source_type, page_count = extract_text_from_payload(filename, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    reader_json = generate_reader_guide(
        document_title=title or Path(filename).stem or "Untitled document",
        source_text=extracted_text,
        settings=settings,
    )

    object_path = build_object_path(
        "users",
        current_user.id,
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
        user_id=current_user.id,
        title=title or Path(filename).stem or "Untitled document",
        original_filename=filename,
        content_type=file.content_type,
        source_type=source_type,
        storage_bucket=settings.supabase_documents_bucket,
        storage_path=object_path,
        extracted_text=extracted_text,
        reader_json=reader_json,
        page_count=page_count,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document
