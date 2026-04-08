"""Provider factory."""
from __future__ import annotations

from app.core.config import settings
from app.services.ai.providers.base import BaseProvider


def get_provider() -> BaseProvider:
    if settings.AI_PROVIDER == "anthropic":
        from app.services.ai.providers.anthropic import AnthropicProvider
        return AnthropicProvider()
    else:
        from app.services.ai.providers.ollama import OllamaProvider
        return OllamaProvider()
