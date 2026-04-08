"""Model routing based on query complexity."""
from __future__ import annotations

import re

from app.core.config import settings

_COMPLEX_KEYWORDS = re.compile(
    r"lập kế hoạch|phân tích|tổng hợp|báo cáo|chiến lược|"
    r"so sánh|đánh giá|thiết kế|đề xuất|viết email|soạn thảo",
    re.IGNORECASE,
)


def route_model(user_message: str) -> str:
    """Pick fast vs smart model based on message complexity."""
    is_complex = len(user_message) > 300 or bool(_COMPLEX_KEYWORDS.search(user_message))
    if settings.AI_PROVIDER == "anthropic":
        return settings.ANTHROPIC_SMART_MODEL if is_complex else settings.ANTHROPIC_FAST_MODEL
    return settings.OLLAMA_SMART_MODEL if is_complex else settings.OLLAMA_FAST_MODEL
