from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import (
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthUserRead,
    TokenResponse,
)
from app.services.auth import (
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user: User, settings: Settings) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user=user, settings=settings),
        user=user,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: AuthRegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = create_user(
        db=db,
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    return _build_token_response(user, settings)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: AuthLoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    user = authenticate_user(db=db, email=payload.email, password=payload.password)
    return _build_token_response(user, settings)


@router.get("/me", response_model=AuthUserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
