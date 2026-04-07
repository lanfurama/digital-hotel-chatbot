"""
APScheduler: chạy in-process, kiểm tra reminders mỗi phút.
Kết nối với notification hub để push SSE tới client đang online.
"""
import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Notification hub: map user_id → set of asyncio.Queue
# ---------------------------------------------------------------------------
_queues: dict[str, set[asyncio.Queue]] = defaultdict(set)


def subscribe(user_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _queues[user_id].add(q)
    return q


def unsubscribe(user_id: str, q: asyncio.Queue) -> None:
    _queues[user_id].discard(q)
    if not _queues[user_id]:
        del _queues[user_id]


async def push_notification(user_id: str, payload: dict) -> None:
    for q in list(_queues.get(user_id, [])):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


# ---------------------------------------------------------------------------
# Scheduler job
# ---------------------------------------------------------------------------
async def _check_reminders() -> None:
    from sqlalchemy import select, update

    from app.core.database import AsyncSessionLocal
    from app.models.reminder import Reminder

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Reminder).where(
                Reminder.remind_at <= now,
                Reminder.is_sent == False,  # noqa: E712
            )
        )
        reminders = result.scalars().all()

        for reminder in reminders:
            payload = {
                "type": "reminder",
                "id": str(reminder.id),
                "title": reminder.title,
                "message": reminder.message,
                "task_id": str(reminder.task_id) if reminder.task_id else None,
            }

            # Push SSE notification (web)
            if "web" in reminder.channels:
                await push_notification(str(reminder.user_id), payload)

            # Gửi Zalo nếu user có Zalo ID
            if "zalo" in reminder.channels:
                from sqlalchemy import select
                from app.models.user import User
                user_result = await db.execute(select(User).where(User.id == reminder.user_id))
                user = user_result.scalar_one_or_none()
                if user and user.google_id and user.google_id.startswith("zalo_"):
                    zalo_id = user.google_id.replace("zalo_", "")
                    zalo_text = f"⏰ Nhắc nhở: {reminder.title}"
                    if reminder.message:
                        zalo_text += f"\n{reminder.message}"
                    try:
                        from app.services.zalo import send_text_message
                        await send_text_message(zalo_id, zalo_text)
                    except Exception as e:
                        log.warning(f"Zalo reminder failed: {e}")

            reminder.is_sent = True
            log.info(f"Reminder sent: {reminder.id} → user {reminder.user_id}")

        await db.commit()


scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")


def start_scheduler() -> None:
    scheduler.add_job(_check_reminders, "interval", minutes=1, id="check_reminders")
    scheduler.start()
    log.info("Scheduler started")


def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
