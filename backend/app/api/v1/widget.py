"""
Widget endpoints:
  POST /widget/message       — SSE chat dùng client_api_key
  GET  /widget/clients       — List clients (admin)
  POST /widget/clients       — Tạo client mới (admin)
  DELETE /widget/clients/{id} — Vô hiệu hoá client (admin)
"""
import secrets
import uuid
from datetime import datetime, timezone
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.deps import require_role
from app.models.client import Client
from app.models.message import Message
from app.models.session import Session
from app.schemas.chat import ChatRequest
from app.schemas.client import ClientCreate, ClientOut
from app.services.ai import build_system_prompt, maybe_summarize, route_model, stream_chat
from app.services.knowledge import rag_search
from app.services.response_guard import scan_token

import json
import time

router = APIRouter(prefix="/widget", tags=["widget"])


# ---------------------------------------------------------------------------
# Auth helper: validate api_key + origin
# ---------------------------------------------------------------------------

async def _get_client(
    db: AsyncSession,
    api_key: str,
    origin: str | None,
) -> Client:
    result = await db.execute(
        select(Client).where(Client.api_key == api_key, Client.is_active == True)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(401, "API key không hợp lệ")

    # Validate Origin nếu client có domain được cấu hình
    if client.domain and origin:
        allowed = client.domain.rstrip("/")
        if not origin.rstrip("/").endswith(allowed.lstrip("https://").lstrip("http://")):
            raise HTTPException(403, f"Origin '{origin}' không được phép")

    return client


# ---------------------------------------------------------------------------
# Widget SSE chat endpoint
# ---------------------------------------------------------------------------

async def _widget_sse_generator(
    db: AsyncSession,
    client: Client,
    session: Session,
    user_message: str,
) -> AsyncGenerator[str, None]:
    """Giống _sse_generator của chat nhưng filter RAG theo client_id."""

    rag_chunks = await rag_search(
        db, user_message,
        user_roles=["public"],
        client_id=client.id,
    )

    # Dùng tên widget làm "user" ảo
    system_prompt = build_system_prompt(
        user_name="Khách",
        user_role="public",
        department=None,
        rag_chunks=rag_chunks,
    )

    context_window = await maybe_summarize(list(session.context_window or []))
    model = route_model(user_message)

    yield f"data: {json.dumps({'type': 'model', 'model': model})}\n\n"

    if rag_chunks:
        sources = [{"title": c["title"], "score": round(c["score"], 3)} for c in rag_chunks]
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    start_ms = time.monotonic()
    full_text = ""
    input_tokens = output_tokens = 0
    blocked = False

    async for event_type, data in stream_chat(system_prompt, context_window, user_message, model):
        if event_type == "token":
            token, is_blocked = scan_token(data)
            if is_blocked:
                blocked = True
                yield f"data: {json.dumps({'type': 'error', 'message': 'Nội dung bị chặn'})}\n\n"
                break
            full_text += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
        elif event_type == "done":
            try:
                meta = json.loads(data)
                input_tokens = meta.get("input_tokens", 0)
                output_tokens = meta.get("output_tokens", 0)
            except Exception:
                pass
        elif event_type == "error":
            yield f"data: {json.dumps({'type': 'error', 'message': data})}\n\n"
            return

    if blocked:
        return

    latency_ms = int((time.monotonic() - start_ms) * 1000)
    total_tokens = input_tokens + output_tokens

    new_context = list(context_window) + [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": full_text},
    ]
    session.context_window = new_context
    flag_modified(session, "context_window")
    session.token_count = (session.token_count or 0) + total_tokens
    session.updated_at = datetime.now(timezone.utc)

    db.add_all([
        Message(id=uuid.uuid4(), session_id=session.id, role="user", content=user_message,
                token_count=input_tokens, created_at=datetime.now(timezone.utc)),
        Message(id=uuid.uuid4(), session_id=session.id, role="assistant", content=full_text,
                model_used=model, token_count=output_tokens, latency_ms=latency_ms,
                created_at=datetime.now(timezone.utc)),
    ])
    await db.commit()

    yield f"data: {json.dumps({'type': 'done', 'session_id': str(session.id), 'latency_ms': latency_ms})}\n\n"


@router.post("/message")
async def widget_message(
    request: Request,
    body: ChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_widget_key: Annotated[str | None, Header()] = None,
):
    """Widget chat endpoint — dùng X-Widget-Key header thay vì JWT."""
    if not x_widget_key:
        raise HTTPException(401, "Thiếu X-Widget-Key header")

    origin = request.headers.get("origin")
    client = await _get_client(db, x_widget_key, origin)

    if not body.message.strip():
        raise HTTPException(400, "Message không được rỗng")

    # Sanitize input từ external channel
    from app.middleware.security import sanitize_user_input
    clean_msg, is_suspicious = sanitize_user_input(body.message)
    if is_suspicious:
        import logging
        logging.getLogger(__name__).warning(f"Prompt injection attempt từ widget client {x_widget_key[:8]}...")
        raise HTTPException(400, "Nội dung không hợp lệ")

    # Tìm hoặc tạo session widget
    session = None
    if body.session_id:
        result = await db.execute(
            select(Session).where(Session.id == body.session_id, Session.client_id == client.id)
        )
        session = result.scalar_one_or_none()

    if not session:
        # Tạo anonymous user cho widget visitor
        from app.models.user import User
        anon_user = User(
            id=uuid.uuid4(),
            name="Widget Visitor",
            email=f"widget_{uuid.uuid4().hex[:8]}@widget.internal",
            role="staff",
        )
        db.add(anon_user)
        await db.flush()

        session = Session(
            id=uuid.uuid4(),
            user_id=anon_user.id,
            channel="widget",
            client_id=client.id,
            context_window=[],
            token_count=0,
        )
        db.add(session)
        await db.flush()

    return StreamingResponse(
        _widget_sse_generator(db, client, session, clean_msg.strip()),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": origin or "*",
        },
    )


# ---------------------------------------------------------------------------
# Client management (admin only)
# ---------------------------------------------------------------------------

@router.get("/clients", response_model=list[ClientOut], dependencies=[require_role("admin")])
async def list_clients(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    return [ClientOut.model_validate(c) for c in result.scalars().all()]


@router.post("/clients", response_model=ClientOut, dependencies=[require_role("admin")])
async def create_client(
    body: ClientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    api_key = f"wk_{secrets.token_urlsafe(32)}"
    client = Client(
        id=uuid.uuid4(),
        name=body.name,
        domain=body.domain,
        api_key=api_key,
        widget_color=body.widget_color,
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return ClientOut.model_validate(client)


@router.post("/clients/{client_id}/crawl", dependencies=[require_role("admin")])
async def trigger_crawl(
    client_id: uuid.UUID,
    url: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Trigger crawl website cho một client. Chạy background."""
    result = await db.execute(select(Client).where(Client.id == client_id, Client.is_active == True))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client không tồn tại")

    from app.models.crawl import CrawlJob
    job = CrawlJob(
        id=uuid.uuid4(),
        client_id=client_id,
        url=url,
        status="pending",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    import asyncio
    from app.services.crawler import crawl_and_index
    asyncio.create_task(crawl_and_index(client_id, url, job.id))

    return {"job_id": str(job.id), "status": "started", "url": url}


@router.get("/clients/{client_id}/crawl-jobs", dependencies=[require_role("admin")])
async def list_crawl_jobs(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.crawl import CrawlJob
    result = await db.execute(
        select(CrawlJob)
        .where(CrawlJob.client_id == client_id)
        .order_by(CrawlJob.created_at.desc())
        .limit(20)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id), "url": j.url, "status": j.status,
            "pages_found": j.pages_found, "pages_done": j.pages_done,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
        }
        for j in jobs
    ]


@router.delete("/clients/{client_id}", dependencies=[require_role("admin")])
async def disable_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(404, "Client không tồn tại")
    client.is_active = False
    await db.commit()
    return {"message": "Đã vô hiệu hoá client"}
