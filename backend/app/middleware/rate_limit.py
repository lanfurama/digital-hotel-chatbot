"""
Per-user + per-IP rate limiting middleware.
Dùng sliding window counter in-memory (không cần Redis).
Nginx đã có rate limiting ở tầng L7; đây là tầng ứng dụng cho các endpoint nhạy cảm.
"""
import time
from collections import defaultdict

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.security import verify_access_token

# Cấu hình limit theo route prefix
_LIMITS: dict[str, tuple[int, int]] = {
    # (max_requests, window_seconds)
    "/api/v1/chat/message": (30, 60),       # 30 req/min per user
    "/api/v1/widget/message": (20, 60),     # 20 req/min per IP
    "/api/v1/auth/google": (10, 60),        # 10 req/min per IP
    "/api/v1/knowledge/upload": (10, 60),   # 10 uploads/min per user
}

# {key → [(timestamp), ...]}
_windows: dict[str, list[float]] = defaultdict(list)


def _get_limit(path: str) -> tuple[int, int] | None:
    for prefix, limit in _LIMITS.items():
        if path.startswith(prefix):
            return limit
    return None


def _check_rate(key: str, max_req: int, window_sec: int) -> bool:
    """True = allowed, False = rate limited."""
    now = time.monotonic()
    cutoff = now - window_sec
    hits = _windows[key]

    # Xóa hits ngoài window
    while hits and hits[0] < cutoff:
        hits.pop(0)

    if len(hits) >= max_req:
        return False

    hits.append(now)
    return True


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        limit = _get_limit(request.url.path)
        if limit is None:
            return await call_next(request)

        max_req, window_sec = limit

        # Dùng user_id nếu có token, fallback về IP
        user_key = request.client.host if request.client else "unknown"
        access_token = request.cookies.get("access_token")
        if access_token:
            uid = verify_access_token(access_token)
            if uid:
                user_key = f"user:{uid}"
        # Widget dùng api_key header
        widget_key = request.headers.get("x-widget-key")
        if widget_key:
            user_key = f"widget:{widget_key[:16]}"

        rate_key = f"{request.url.path}:{user_key}"

        if not _check_rate(rate_key, max_req, window_sec):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Quá nhiều yêu cầu. Giới hạn {max_req} request/{window_sec}s."
                },
                headers={"Retry-After": str(window_sec)},
            )

        return await call_next(request)
