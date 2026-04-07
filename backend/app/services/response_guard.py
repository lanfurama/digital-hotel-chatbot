"""
Response Guard: scan output trước khi stream về client.
Phát hiện và block/redact thông tin nhạy cảm.
"""
import re

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------
_PATTERNS = [
    # CCCD / CMND Việt Nam (9 hoặc 12 số)
    (re.compile(r"\b\d{9}\b|\b\d{12}\b"), "[CCCD đã ẩn]"),
    # Số thẻ tín dụng (16 số, có thể cách nhau bởi dấu cách/gạch)
    (re.compile(r"\b(?:\d[ -]?){15}\d\b"), "[Số thẻ đã ẩn]"),
    # Số tài khoản ngân hàng VN (9-14 số)
    (re.compile(r"\b\d{9,14}\b"), "[Số tài khoản đã ẩn]"),
    # Pattern "password", "mật khẩu" kèm giá trị
    (
        re.compile(
            r"(password|mật\s*khẩu|passwd|pwd)\s*[:=]\s*\S+",
            re.IGNORECASE,
        ),
        "[Mật khẩu đã ẩn]",
    ),
    # Token / secret key dạng base64-like (>30 ký tự liên tiếp không có space)
    (re.compile(r"\b[A-Za-z0-9+/]{32,}={0,2}\b"), "[Token đã ẩn]"),
]

# Từ khóa cần BLOCK hoàn toàn (không stream về client)
_BLOCK_KEYWORDS = re.compile(
    r"anthropic_api_key|ANTHROPIC_API_KEY|sk-ant-",
    re.IGNORECASE,
)


def scan_and_redact(text: str) -> tuple[str, bool]:
    """
    Trả về (redacted_text, is_blocked).
    is_blocked=True khi phát hiện nội dung cần chặn hoàn toàn.
    """
    if _BLOCK_KEYWORDS.search(text):
        return "[Nội dung bị chặn do chứa thông tin bảo mật]", True

    result = text
    for pattern, replacement in _PATTERNS:
        result = pattern.sub(replacement, result)

    return result, False


def scan_token(token: str) -> tuple[str, bool]:
    """
    Scan từng token streaming. Trả về (token_hoặc_redacted, is_blocked).
    Dùng pattern đơn giản hơn để tránh false positive khi text bị cắt giữa chừng.
    """
    if _BLOCK_KEYWORDS.search(token):
        return "", True
    return token, False
