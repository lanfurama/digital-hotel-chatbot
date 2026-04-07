"""
Chat endpoints:
  POST /chat/message          — Gửi tin nhắn, nhận SSE streaming
  GET  /chat/sessions         — Danh sách sessions của user
  GET  /chat/sessions/{id}/messages — Lịch sử messages
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.core.deps import CurrentUser
from app.models.message import Message
from app.models.session import Session
from app.models.user import User
from app.schemas.chat import ChatRequest, MessageOut, SessionOut
from app.services.ai import (
    build_system_prompt,
    maybe_summarize,
    route_model,
    stream_chat,
)
from app.services.knowledge import rag_search
from app.services.response_guard import scan_token

router = APIRouter(prefix="/chat", tags=["chat"])

ROLES_ACCESS = {
    "admin": ["public", "staff", "manager", "admin"],
    "manager": ["public", "staff", "manager"],
    "staff": ["public", "staff"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_session(
    db: AsyncSession,
    user: User,
    session_id: uuid.UUID | None,
) -> Session:
    if session_id:
        result = await db.execute(
            select(Session).where(Session.id == session_id, Session.user_id == user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "Session không tồn tại")
        return session

    session = Session(
        id=uuid.uuid4(),
        user_id=user.id,
        channel="web",
        context_window=[],
        token_count=0,
    )
    db.add(session)
    await db.flush()
    return session


async def _sse_generator(
    db: AsyncSession,
    session: Session,
    user: User,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """Toàn bộ pipeline: RAG → build prompt → stream → guard → save."""

    # 1. RAG search (bọc try/except để embedding lỗi không crash toàn bộ)
    allowed_levels = ROLES_ACCESS.get(user.role, ["public", "staff"])
    try:
        rag_chunks = await rag_search(db, user_message, allowed_levels)
    except Exception as e:
        logger.warning(f"RAG search failed, continuing without context: {e}")
        rag_chunks = []

    # 2. System prompt
    system_prompt = build_system_prompt(
        user_name=user.name,
        user_role=user.role,
        department=user.department,
        rag_chunks=rag_chunks,
    )

    # 3. Context window (summarize nếu cần)
    try:
        context_window = await maybe_summarize(list(session.context_window or []))
    except Exception as e:
        logger.warning(f"Summarize failed, using raw context: {e}")
        context_window = list(session.context_window or [])

    # 4. Route model
    model = route_model(user_message)
    yield f"data: {json.dumps({'type': 'model', 'model': model})}\n\n"

    if rag_chunks:
        sources = [{"title": c["title"], "score": round(c["score"], 3)} for c in rag_chunks]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    # 5. Stream từ Ollama
    start_ms = time.monotonic()
    full_text = ""
    input_tokens = 0
    output_tokens = 0
    blocked = False

    logger.info(f"[CHAT] user={user.email} model={model} message={user_message!r}")

    async for event_type, data in stream_chat(system_prompt, context_window, user_message, model, db=db, user=user):
        if event_type == "token":
            token, is_blocked = scan_token(data)
            if is_blocked:
                blocked = True
                yield f"data: {json.dumps({'type': 'error', 'message': 'Nội dung bị chặn bởi Response Guard'})}\n\n"
                break
            full_text += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        elif event_type == "tool_call":
            logger.info(f"[TOOL] calling: {data}")
            yield f"data: {json.dumps({'type': 'tool_call', 'tool': data})}\n\n"

        elif event_type == "tool_result":
            logger.info(f"[TOOL] result: {data[:200]}")
            yield f"data: {json.dumps({'type': 'tool_result', 'result': data})}\n\n"

        elif event_type == "done":
            try:
                meta = json.loads(data)
                input_tokens = meta.get("input_tokens", 0)
                output_tokens = meta.get("output_tokens", 0)
            except Exception:
                pass

        elif event_type == "error":
            logger.error(f"[CHAT ERROR] {data}")
            yield f"data: {json.dumps({'type': 'error', 'message': data})}\n\n"
            return

    logger.info(f"[CHAT] response ({len(full_text)} chars, {input_tokens}+{output_tokens} tokens): {full_text[:300]!r}")

    if blocked:
        return

    latency_ms = int((time.monotonic() - start_ms) * 1000)
    total_tokens = input_tokens + output_tokens

    # 6. Cập nhật context_window
    new_context = list(context_window) + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": full_text},
    ]
    session.context_window = new_context
    session.token_count = (session.token_count or 0) + total_tokens
    session.updated_at = datetime.now(timezone.utc)

    # Auto-title nếu chưa có
    if not session.title:
        session.title = user_message[:80]

    # 7. Lưu messages vào DB
    user_msg = Message(
        id=uuid.uuid4(),
        session_id=session.id,
        role="user",
        content=user_message,
        token_count=input_tokens,
        created_at=datetime.now(timezone.utc),
    )
    assistant_msg = Message(
        id=uuid.uuid4(),
        session_id=session.id,
        role="assistant",
        content=full_text,
        model_used=model,
        token_count=output_tokens,
        latency_ms=latency_ms,
        created_at=datetime.now(timezone.utc),
    )
    db.add_all([user_msg, assistant_msg])
    await db.commit()

    yield f"data: {json.dumps({'type': 'done', 'session_id': str(session.id), 'message_id': str(assistant_msg.id), 'latency_ms': latency_ms, 'tokens': total_tokens})}\n\n"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/message")
async def chat_message(
    body: ChatRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Gửi message, nhận SSE stream (token-by-token)."""
    print(f"[CHAT ENDPOINT HIT] user={current_user.email} msg={body.message!r}", flush=True)
    if not body.message.strip():
        raise HTTPException(400, "Message không được rỗng")

    session = await _get_or_create_session(db, current_user, body.session_id)

    return StreamingResponse(
        _sse_generator(db, session, current_user, body.message.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Session)
        .where(Session.user_id == current_user.id, Session.is_active == True)
        .order_by(Session.updated_at.desc())
        .limit(50)
    )
    return [SessionOut.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def session_messages(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Verify session thuộc về user
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, "Session không tồn tại")

    msgs = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return [MessageOut.model_validate(m) for m in msgs.scalars().all()]


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session không tồn tại")
    session.is_active = False
    await db.commit()
    return {"message": "Đã xóa session"}
