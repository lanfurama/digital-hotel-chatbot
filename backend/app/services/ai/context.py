"""Context window management and summarization."""
from __future__ import annotations

from app.core.config import settings
from app.services.ai.providers import get_provider

MAX_CONTEXT_MESSAGES = 20


async def maybe_summarize(
    context_window: list[dict],
    model: str | None = None,
) -> list[dict]:
    """Summarize old messages if context exceeds MAX_CONTEXT_MESSAGES."""
    if len(context_window) <= MAX_CONTEXT_MESSAGES:
        return context_window

    half = len(context_window) // 2
    old_messages = context_window[:half]
    recent_messages = context_window[half:]

    summary_prompt = (
        "Tóm tắt ngắn gọn (5-10 câu) cuộc hội thoại sau, giữ lại các thông tin quan trọng:\n\n"
        + "\n".join(f"{m['role']}: {m['content']}" for m in old_messages)
    )

    _model = model
    if not _model:
        _model = (
            settings.ANTHROPIC_FAST_MODEL
            if settings.AI_PROVIDER == "anthropic"
            else settings.OLLAMA_FAST_MODEL
        )

    provider = get_provider()
    summary_text = await provider.complete(
        system_prompt="",
        messages=[{"role": "user", "content": summary_prompt}],
        model=_model,
        max_tokens=512,
    )

    return [
        {"role": "assistant", "content": f"[Tóm tắt hội thoại trước]\n{summary_text}"}
    ] + recent_messages
