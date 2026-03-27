from fastapi import APIRouter

from .routes.auth import router as auth_router
from .routes.documents import router as documents_router
from .routes.health import router as health_router
from .routes.notes import router as notes_router
from .routes.sessions import router as sessions_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(documents_router)
api_router.include_router(sessions_router)
api_router.include_router(notes_router)
