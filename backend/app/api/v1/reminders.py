"""
Reminder CRUD + SSE notification stream.
GET /reminders/stream  — client giữ kết nối SSE để nhận reminder live.
"""
import asyncio
import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.reminder import Reminder
from app.schemas.task import ReminderCreate, ReminderOut
from app.services.scheduler import push_notification, subscribe, unsubscribe

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[ReminderOut])
async def list_reminders(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Reminder)
        .where(Reminder.user_id == current_user.id)
        .order_by(Reminder.remind_at.asc())
    )
    return [ReminderOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=ReminderOut)
async def create_reminder(
    body: ReminderCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    reminder = Reminder(
        id=uuid.uuid4(),
        user_id=current_user.id,
        **body.model_dump(),
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return ReminderOut.model_validate(reminder)


@router.delete("/{reminder_id}")
async def delete_reminder(
    reminder_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Reminder).where(
            Reminder.id == reminder_id,
            Reminder.user_id == current_user.id,
        )
    )
    reminder = result.scalar_one_or_none()
    if not reminder:
        raise HTTPException(404, "Reminder không tồn tại")
    await db.delete(reminder)
    await db.commit()
    return {"message": "Đã xóa reminder"}


# ---------------------------------------------------------------------------
# SSE stream endpoint — client giữ kết nối để nhận notification
# ---------------------------------------------------------------------------

async def _notification_generator(user_id: str, request: Request):
    q = subscribe(user_id)
    try:
        # Ping ngay lúc kết nối để client biết stream đã sẵn sàng
        yield f"data: {json.dumps({'type': 'connected'})}\n\n"

        while True:
            if await request.is_disconnected():
                break
            try:
                payload = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {json.dumps(payload)}\n\n"
            except asyncio.TimeoutError:
                # Keepalive ping mỗi 30s
                yield ": ping\n\n"
    finally:
        unsubscribe(user_id, q)


@router.get("/stream")
async def notification_stream(current_user: CurrentUser, request: Request):
    """SSE endpoint — giữ kết nối để nhận reminder notification real-time."""
    return StreamingResponse(
        _notification_generator(str(current_user.id), request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
