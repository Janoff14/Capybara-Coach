from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.user import User


def get_or_create_default_user(session: Session, settings: Settings) -> User:
    statement = select(User).where(User.email == settings.default_user_email)
    user = session.scalars(statement).one_or_none()
    if user is not None:
        return user

    user = User(
        email=settings.default_user_email,
        display_name=settings.default_user_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
