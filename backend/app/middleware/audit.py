"""
Audit log middleware: ghi log 100% requests vào bảng audit_logs.
"""
import time
import uuid

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.database import AsyncSessionLocal
from app.core.security import verify_access_token
from app.models.audit import AuditLog

# Các path không cần audit (health check, static...)
_SKIP_PATHS = {"/health", "/api/docs", "/openapi.json", "/favicon.ico"}


def _action_from_request(method: str, path: str) -> str:
    """Chuyển method + path → tên action ngắn gọn."""
    parts = path.strip("/").split("/")
    resource = parts[-1] if parts else "unknown"
    mapping = {"GET": "read", "POST": "create", "PUT": "update",
               "PATCH": "update", "DELETE": "delete"}
    verb = mapping.get(method, method.lower())
    return f"{verb}_{resource}"


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        latency_ms = int((time.monotonic() - start) * 1000)

        # Lấy user_id từ cookie nếu có
        user_id = None
        access_token = request.cookies.get("access_token")
        if access_token:
            uid_str = verify_access_token(access_token)
            if uid_str:
                try:
                    user_id = uuid.UUID(uid_str)
                except ValueError:
                    pass

        ip = request.client.host if request.client else None
        action = _action_from_request(request.method, request.url.path)

        # Ghi log async (không block response)
        try:
            async with AsyncSessionLocal() as db:
                log = AuditLog(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    action=action,
                    resource_type=request.url.path.split("/")[-2] if "/" in request.url.path else None,
                    metadata_={"method": request.method, "path": request.url.path, "latency_ms": latency_ms},
                    ip_address=ip,
                    user_agent=request.headers.get("user-agent"),
                    response_code=response.status_code,
                )
                db.add(log)
                await db.commit()
        except Exception:
            pass  # Không bao giờ để audit log break request

        return response
