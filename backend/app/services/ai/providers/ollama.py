"""Ollama (local LLM) provider."""
from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import httpx

from app.core.config import settings
from app.services.ai.providers.base import BaseProvider


class OllamaProvider(BaseProvider):

    async def stream(
        self,
        system_prompt: str,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        db: Any = None,
        user: Any = None,
    ) -> AsyncGenerator[tuple[str, str], None]:
        from app.services.tools import TOOL_DEFINITIONS_OLLAMA, execute_tool

        msgs: list[dict] = (
            [{"role": "system", "content": system_prompt}]
            + list(messages)
        )
        total_input = 0
        total_output = 0

        try:
            for _ in range(5):
                request_body: dict = {
                    "model": model,
                    "messages": msgs,
                    "stream": True,
                    "keep_alive": "10m",
                }
                if db and user:
                    request_body["tools"] = TOOL_DEFINITIONS_OLLAMA

                full_text = ""
                tool_calls: list[dict] = []

                async with httpx.AsyncClient(timeout=120.0) as client:
                    async with client.stream(
                        "POST",
                        f"{settings.OLLAMA_BASE_URL}/api/chat",
                        json=request_body,
                    ) as response:
                        response.raise_for_status()
                        async for line in response.aiter_lines():
                            if not line:
                                continue
                            try:
                                chunk = json.loads(line)
                            except json.JSONDecodeError:
                                continue

                            msg = chunk.get("message", {})
                            content = msg.get("content", "")

                            if content:
                                full_text += content
                                yield ("token", content)

                            if chunk.get("done"):
                                tool_calls = msg.get("tool_calls") or []
                                total_input += chunk.get("prompt_eval_count", 0)
                                total_output += chunk.get("eval_count", 0)

                if not tool_calls or not db or not user:
                    break

                msgs.append({
                    "role": "assistant",
                    "content": full_text,
                    "tool_calls": tool_calls,
                })

                for tc in tool_calls:
                    func = tc.get("function", {})
                    tool_name = func.get("name", "")
                    tool_input = func.get("arguments", {})

                    yield ("tool_call", tool_name)
                    result_text = await execute_tool(tool_name, tool_input, db, user)
                    yield ("tool_result", result_text)

                    msgs.append({"role": "tool", "content": result_text})

            yield (
                "done",
                json.dumps({
                    "model": model,
                    "input_tokens": total_input,
                    "output_tokens": total_output,
                }),
            )
        except Exception as e:
            yield ("error", str(e))

    async def complete(
        self,
        system_prompt: str,
        messages: list[dict],
        model: str,
        max_tokens: int = 1024,
    ) -> str:
        all_messages = [{"role": "system", "content": system_prompt}] + messages
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": model,
                    "messages": all_messages,
                    "stream": False,
                    "keep_alive": "10m",
                    "options": {"num_predict": max_tokens},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]
