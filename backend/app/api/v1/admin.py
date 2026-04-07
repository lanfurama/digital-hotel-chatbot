"""
Admin endpoints — chỉ dành cho role admin.
"""
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.audit import AuditLog
from app.models.knowledge import KnowledgeDoc
from app.models.message import Message
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/admin", tags=["admin"])

AdminUser = require_role("admin")


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", dependencies=[AdminUser])
async def get_stats(db: Annotated[AsyncSession, Depends(get_db)]):
    total_users = await db.scalar(select(func.count()).select_from(User).where(User.is_active == True))
    total_messages = await db.scalar(select(func.count()).select_from(Message))
    total_sessions = await db.scalar(select(func.count()).select_from(Session))
    total_docs = await db.scalar(select(func.count()).select_from(KnowledgeDoc).where(KnowledgeDoc.is_active == True))
    total_tokens = await db.scalar(select(func.sum(Message.token_count)).select_from(Message)) or 0

    return {
        "users": total_users,
        "messages": total_messages,
        "sessions": total_sessions,
        "knowledge_docs": total_docs,
        "total_tokens": total_tokens,
    }


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users", response_model=list[UserOut], dependencies=[AdminUser])
async def list_users(db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.put("/users/{user_id}/role", dependencies=[AdminUser])
async def change_user_role(
    user_id: uuid.UUID,
    role: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if role not in ("admin", "manager", "staff"):
        raise HTTPException(400, "Role không hợp lệ. Chọn: admin | manager | staff")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Người dùng không tồn tại")

    user.role = role
    await db.commit()
    return {"message": f"Đã đổi role thành {role}", "user_id": str(user_id)}


@router.put("/users/{user_id}/active", dependencies=[AdminUser])
async def toggle_user_active(
    user_id: uuid.UUID,
    is_active: bool,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Người dùng không tồn tại")
    user.is_active = is_active
    await db.commit()
    return {"message": f"Tài khoản đã {'kích hoạt' if is_active else 'vô hiệu hoá'}"}


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------

@router.get("/cost-estimate", dependencies=[AdminUser])
async def cost_estimate(
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = 7,
):
    """Ước tính chi phí Claude API trong N ngày gần nhất."""
    from datetime import timedelta
    from sqlalchemy import and_

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    result = await db.execute(
        select(
            func.sum(Message.token_count).label("total_tokens"),
            func.count().label("total_messages"),
        )
        .where(
            Message.created_at >= cutoff,
            Message.role == "assistant",
        )
    )
    row = result.first()
    total_tokens = int(row.total_tokens or 0) if row else 0
    total_messages = int(row.total_messages or 0) if row else 0

    # Giá tham khảo (USD per 1M tokens, tháng 4/2025)
    HAIKU_PRICE = 0.80   # $0.80/1M output tokens
    SONNET_PRICE = 15.0  # $15/1M output tokens

    # Lấy breakdown theo model
    model_result = await db.execute(
        select(Message.model_used, func.sum(Message.token_count).label("tokens"))
        .where(Message.created_at >= cutoff, Message.role == "assistant")
        .group_by(Message.model_used)
    )
    model_breakdown = {}
    estimated_usd = 0.0
    for row in model_result.fetchall():
        model = row.model_used or "unknown"
        tokens = int(row.tokens or 0)
        price = HAIKU_PRICE if "haiku" in model else SONNET_PRICE
        cost = (tokens / 1_000_000) * price
        model_breakdown[model] = {"tokens": tokens, "cost_usd": round(cost, 4)}
        estimated_usd += cost

    return {
        "period_days": days,
        "total_tokens": total_tokens,
        "total_messages": total_messages,
        "estimated_cost_usd": round(estimated_usd, 4),
        "estimated_cost_monthly_usd": round(estimated_usd / days * 30, 2),
        "model_breakdown": model_breakdown,
        "note": "Ước tính dựa trên giá tháng 4/2025. Kiểm tra Anthropic Console để có số chính xác.",
    }


@router.get("/audit-logs", dependencies=[AdminUser])
async def get_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 100,
    offset: int = 0,
):
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "user_id": str(l.user_id) if l.user_id else None,
            "action": l.action,
            "resource_type": l.resource_type,
            "ip_address": str(l.ip_address) if l.ip_address else None,
            "response_code": l.response_code,
            "metadata": l.metadata_,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
