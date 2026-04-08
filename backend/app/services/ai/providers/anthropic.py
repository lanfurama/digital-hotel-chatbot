"""Anthropic (Claude) provider."""
from __future__ import annotations

import json
from typing import Any, AsyncGenerator

import anthropic

from app.core.config import settings
from app.services.ai.providers.base import BaseProvider


class AnthropicProvider(BaseProvider):

    async def stream(
        self,
        system_prompt: str,
        messages: list[dict],
        model: str,
        tools: list[dict] | None = None,
        db: Any = None,
        user: Any = None,
    ) -> AsyncGenerator[tuple[str, str], None]:
        from app.services.tools import TOOL_DEFINITIONS, execute_tool

        msgs: list[dict] = list(messages)
        total_input = 0
        total_output = 0
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

        try:
            for _ in range(5):
                kwargs: dict = {
                    "model": model,
                    "max_tokens": 4096,
                    "system": system_prompt,
                    "messages": msgs,
                }
                if db and user:
                    kwargs["tools"] = TOOL_DEFINITIONS

                tool_uses: list = []
                full_text = ""

                async with client.messages.stream(**kwargs) as stream:
                    async for text in stream.text_stream:
                        full_text += text
                        yield ("token", text)

                    final_msg = await stream.get_final_message()
                    total_input += final_msg.usage.input_tokens
                    total_output += final_msg.usage.output_tokens

                    for block in final_msg.content:
                        if block.type == "tool_use":
                            tool_uses.append(block)

                if not tool_uses:
                    break

                assistant_content: list = []
                if full_text:
                    assistant_content.append({"type": "text", "text": full_text})
                for tu in tool_uses:
                    assistant_content.append({
                        "type": "tool_use",
                        "id": tu.id,
                        "name": tu.name,
                        "input": tu.input,
                    })
                msgs.append({"role": "assistant", "content": assistant_content})

                tool_results: list = []
                for tu in tool_uses:
                    yield ("tool_call", tu.name)
                    result_text = await execute_tool(tu.name, tu.input, db, user)
                    yield ("tool_result", result_text)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": result_text,
                    })
                msgs.append({"role": "user", "content": tool_results})

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
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text
