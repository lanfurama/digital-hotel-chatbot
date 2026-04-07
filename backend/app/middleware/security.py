"""
Security middleware:
1. Prompt injection sanitizer — làm sạch input từ external channels
2. Security headers — HSTS, CSP, X-Frame-Options, ...
"""
import re

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# ---------------------------------------------------------------------------
# Prompt Injection Patterns
# ---------------------------------------------------------------------------
_INJECTION_PATTERNS = [
    # Classic jailbreak attempts
    re.compile(
        r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)",
        re.IGNORECASE,
    ),
    re.compile(r"you\s+are\s+now\s+(a\s+)?(?:dan|jailbreak|unrestricted)", re.IGNORECASE),
    re.compile(r"pretend\s+you\s+(are|have\s+no)\s+(restriction|filter|rule|limit)", re.IGNORECASE),
    re.compile(r"act\s+as\s+(if\s+you\s+are\s+)?(?:an?\s+)?evil|DAN|unrestricted", re.IGNORECASE),
    re.compile(r"system\s*prompt\s*:", re.IGNORECASE),
    re.compile(r"<\s*system\s*>", re.IGNORECASE),
    re.compile(r"\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>"),
    # Prompt leaking
    re.compile(r"(repeat|print|show|reveal|tell me)\s+.{0,30}(system prompt|instructions|context)", re.IGNORECASE),
]

_MAX_INPUT_LENGTH = 4000  # chars


def sanitize_user_input(text: str) -> tuple[str, bool]:
    """
    Làm sạch input từ user.
    Trả về (cleaned_text, is_suspicious).
    is_suspicious=True nếu phát hiện injection attempt.
    """
    if not text:
        return text, False

    # Truncate
    if len(text) > _MAX_INPUT_LENGTH:
        text = text[:_MAX_INPUT_LENGTH]

    # Xóa null bytes và control chars (trừ newline/tab)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Kiểm tra injection patterns
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return text, True

    return text, False


# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    # CSP — cho phép inline scripts của Next.js và widget
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://accounts.google.com https://openapi.zalo.me;"
    ),
}

_HSTS_HEADER = "max-age=31536000; includeSubDomains"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, production: bool = False):
        super().__init__(app)
        self._production = production

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        for header, value in _SECURITY_HEADERS.items():
            response.headers[header] = value
        if self._production:
            response.headers["Strict-Transport-Security"] = _HSTS_HEADER
        return response
