from fastapi import APIRouter

from .routes.auth import router as auth_router
from .routes.documents import router as documents_router
from .routes.flashcards import router as flashcards_router
from .routes.health import router as health_router
from .routes.notes import router as notes_router
from .routes.reviews import router as reviews_router
from .routes.sessions import router as sessions_router
from .routes.sources import router as sources_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(sessions_router)
api_router.include_router(notes_router)
api_router.include_router(flashcards_router)
api_router.include_router(reviews_router)
api_router.include_router(sources_router)
