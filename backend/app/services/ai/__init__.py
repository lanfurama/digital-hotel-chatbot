"""
AI service package.

Public API (backward compatible):
    build_system_prompt, route_model, maybe_summarize, stream_chat, chat_once
"""
from __future__ import annotations

from typing import AsyncGenerator

from app.services.ai.context import maybe_summarize
from app.services.ai.prompts import build_system_prompt
from app.services.ai.providers import get_provider
from app.services.ai.router import route_model


async def stream_chat(
    system_prompt: str,
    context_window: list[dict],
    user_message: str,
    model: str,
    db=None,
    user=None,
) -> AsyncGenerator[tuple[str, str], None]:
    """Stream chat responses. Delegates to the configured provider."""
    messages = list(context_window) + [{"role": "user", "content": user_message}]
    provider = get_provider()
    async for event in provider.stream(system_prompt, messages, model, db=db, user=user):
        yield event


async def chat_once(
    system_prompt: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 1024,
) -> str:
    """Non-streaming single response. Delegates to the configured provider."""
    from app.core.config import settings

    if not model:
        model = (
            settings.ANTHROPIC_FAST_MODEL
            if settings.AI_PROVIDER == "anthropic"
            else settings.OLLAMA_FAST_MODEL
        )
    provider = get_provider()
    return await provider.complete(system_prompt, messages, model, max_tokens)


__all__ = [
    "build_system_prompt",
    "chat_once",
    "maybe_summarize",
    "route_model",
    "stream_chat",
]
