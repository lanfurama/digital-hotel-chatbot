"""Abstract base for AI providers."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator


class BaseProvider(ABC):
    """Interface that all AI providers must implement."""

    @abstractmethod
    async def stream(
        self,
        system_prompt: str,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        db: Any = None,
        user: Any = None,
    ) -> AsyncGenerator[tuple[str, str], None]:
        """Yield (event_type, data) tuples: token, tool_call, tool_result, done, error."""
        ...

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
    ) -> str:
        """Non-streaming single response. Returns the text content."""
        ...
