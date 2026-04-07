from fastapi import APIRouter

from app.api.v1 import admin, auth, chat, knowledge, reminders, tasks, widget, zalo

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(knowledge.router)
api_router.include_router(chat.router)
api_router.include_router(tasks.router)
api_router.include_router(reminders.router)
api_router.include_router(admin.router)
api_router.include_router(widget.router)
api_router.include_router(zalo.router)
