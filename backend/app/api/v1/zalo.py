"""
Zalo OA Webhook.

GET  /zalo/webhook  — Zalo verify webhook (OA dashboard)
POST /zalo/webhook  — Nhận events từ Zalo, xử lý message
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.message import Message
from app.models.session import Session
from app.models.user import User
from app.services.ai import build_system_prompt, route_model
from app.services.knowledge import rag_search
from app.services.zalo import send_text_message

router = APIRouter(prefix="/zalo", tags=["zalo"])


def _verify_signature(raw_body: bytes, signature: str) -> bool:
    """HMAC-SHA256 verify Zalo webhook signature."""
    expected = hmac.new(
        settings.ZALO_OA_SECRET.encode(),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.get("/webhook")
async def zalo_verify(
    hub_mode: str | None = None,
    hub_challenge: str | None = None,
    hub_verify_token: str | None = None,
):
    """Zalo OA webhook verification endpoint."""
    if hub_verify_token == settings.ZALO_OA_SECRET:
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(403, "Verify token không hợp lệ")


@router.post("/webhook")
async def zalo_webhook(request: Request):
    """Nhận và xử lý Zalo OA events."""
    raw_body = await request.body()

    # Verify signature
    signature = request.headers.get("X-ZaloOA-Signature", "")
    if settings.ZALO_OA_SECRET and not _verify_signature(raw_body, signature):
        raise HTTPException(403, "Signature không hợp lệ")

    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored"}

    event_type = payload.get("event_name", "")

    # Chỉ xử lý user gửi message
    if event_type != "follow" and "message" not in payload:
        return {"status": "ignored"}

    follower_id = payload.get("sender", {}).get("id") or payload.get("follower", {}).get("id")
    message_text = payload.get("message", {}).get("text", "").strip()

    if not follower_id or not message_text:
        return {"status": "ignored"}

    # Sanitize input từ external channel
    from app.middleware.security import sanitize_user_input
    message_text, is_suspicious = sanitize_user_input(message_text)
    if is_suspicious:
        import logging
        logging.getLogger(__name__).warning(f"Prompt injection attempt từ Zalo user {follower_id}")
        return {"status": "ignored"}

    # Xử lý bất đồng bộ để trả 200 ngay cho Zalo
    import asyncio
    asyncio.create_task(_handle_zalo_message(follower_id, message_text))

    return {"status": "ok"}


async def _handle_zalo_message(follower_id: str, message_text: str) -> None:
    """Pipeline: tìm/tạo session → RAG → AI (non-streaming) → reply Zalo."""
    async with AsyncSessionLocal() as db:
        # Tìm hoặc tạo user Zalo (dùng google_id field để lưu zalo_id)
        result = await db.execute(
            select(User).where(User.google_id == f"zalo_{follower_id}")
        )
        user = result.scalar_one_or_none()

        if not user:
            # Lấy profile Zalo nếu có token
            name = f"Zalo User {follower_id[-4:]}"
            try:
                from app.services.zalo import get_user_profile
                profile = await get_user_profile(follower_id)
                name = profile.get("display_name", name)
            except Exception:
                pass

            user = User(
                id=uuid.uuid4(),
                name=name,
                email=f"zalo_{follower_id}@zalo.internal",
                google_id=f"zalo_{follower_id}",
                role="staff",
            )
            db.add(user)
            await db.flush()

        # Tìm session Zalo đang active của user
        result = await db.execute(
            select(Session).where(
                Session.user_id == user.id,
                Session.channel == "zalo",
                Session.is_active == True,
            ).order_by(Session.updated_at.desc())
        )
        session = result.scalars().first()

        if not session:
            session = Session(
                id=uuid.uuid4(),
                user_id=user.id,
                channel="zalo",
                context_window=[],
                token_count=0,
            )
            db.add(session)
            await db.flush()

        # RAG search
        rag_chunks = await rag_search(db, message_text, ["public", "staff"])

        # Build prompt + route model
        system_prompt = build_system_prompt(
            user_name=user.name,
            user_role=user.role,
            department=None,
            rag_chunks=rag_chunks,
        )
        model = route_model(message_text)

        # AI call (non-streaming cho Zalo)
        from app.services.ai import chat_once
        messages = list(session.context_window or []) + [
            {"role": "user", "content": message_text}
        ]
        reply_text = await chat_once(system_prompt, messages, model=model, max_tokens=1024)

        # Truncate nếu quá dài cho Zalo (giới hạn 2000 chars)
        if len(reply_text) > 1900:
            reply_text = reply_text[:1897] + "..."

        # Cập nhật context_window
        new_context = messages + [{"role": "assistant", "content": reply_text}]
        session.context_window = new_context[-20:]
        session.updated_at = datetime.now(timezone.utc)

        # Lưu messages
        db.add_all([
            Message(id=uuid.uuid4(), session_id=session.id, role="user", content=message_text,
                    created_at=datetime.now(timezone.utc)),
            Message(id=uuid.uuid4(), session_id=session.id, role="assistant", content=reply_text,
                    model_used=model, created_at=datetime.now(timezone.utc)),
        ])
        await db.commit()

    # Gửi reply về Zalo (ngoài session DB để tránh timeout)
    try:
        await send_text_message(follower_id, reply_text)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Zalo send failed: {e}")
