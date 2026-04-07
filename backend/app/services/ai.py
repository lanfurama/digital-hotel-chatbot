"""
AI Service: system prompt builder, model router, streaming.
Provider được chọn qua AI_PROVIDER trong .env: "anthropic" | "ollama"
"""
from __future__ import annotations

import json
import re
from typing import AsyncGenerator

import anthropic
import httpx

from app.core.config import settings

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------
_SYSTEM_BASE = """\
Bạn là trợ lý AI nội bộ của khách sạn, hỗ trợ nhân viên team Digital.

Nhiệm vụ:
- Tra cứu và giải thích tài liệu, quy trình nội bộ
- Hỗ trợ quản lý công việc và lịch trình
- Soạn thảo email, báo cáo theo yêu cầu
- Trả lời ngắn gọn, chuyên nghiệp bằng tiếng Việt

Thông tin người dùng:
- Tên: {user_name}
- Vai trò: {user_role}
- Phòng ban: {department}
"""

_RAG_SECTION = """\

--- Tài liệu liên quan ---
{chunks}
--- Hết tài liệu ---

Ưu tiên dùng thông tin từ tài liệu trên khi trả lời. \
Nếu tài liệu không đủ, hãy nói rõ và dùng kiến thức chung.
"""


def build_system_prompt(
    user_name: str,
    user_role: str,
    department: str | None,
    rag_chunks: list[dict],
) -> str:
    prompt = _SYSTEM_BASE.format(
        user_name=user_name,
        user_role=user_role,
        department=department or "Chưa xác định",
    )
    if rag_chunks:
        formatted = "\n\n".join(
            f"[{c['title']} — {c['category']}]\n{c['chunk_text']}"
            for c in rag_chunks
        )
        prompt += _RAG_SECTION.format(chunks=formatted)
    return prompt


# ---------------------------------------------------------------------------
# Model router
# ---------------------------------------------------------------------------
_COMPLEX_KEYWORDS = re.compile(
    r"lập kế hoạch|phân tích|tổng hợp|báo cáo|chiến lược|"
    r"so sánh|đánh giá|thiết kế|đề xuất|viết email|soạn thảo",
    re.IGNORECASE,
)


def route_model(user_message: str) -> str:
    is_complex = len(user_message) > 300 or bool(_COMPLEX_KEYWORDS.search(user_message))
    if settings.AI_PROVIDER == "anthropic":
        return settings.ANTHROPIC_SMART_MODEL if is_complex else settings.ANTHROPIC_FAST_MODEL
    return settings.OLLAMA_SMART_MODEL if is_complex else settings.OLLAMA_FAST_MODEL


# ---------------------------------------------------------------------------
# Context window: giữ tối đa 20 messages, summarize nếu quá dài
# ---------------------------------------------------------------------------
MAX_CONTEXT_MESSAGES = 20


async def maybe_summarize(
    context_window: list[dict],
    model: str | None = None,
) -> list[dict]:
    if len(context_window) <= MAX_CONTEXT_MESSAGES:
        return context_window

    half = len(context_window) // 2
    old_messages = context_window[:half]
    recent_messages = context_window[half:]

    summary_prompt = (
        "Tóm tắt ngắn gọn (5-10 câu) cuộc hội thoại sau, giữ lại các thông tin quan trọng:\n\n"
        + "\n".join(f"{m['role']}: {m['content']}" for m in old_messages)
    )

    if settings.AI_PROVIDER == "anthropic":
        _model = model or settings.ANTHROPIC_FAST_MODEL
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=_model,
            max_tokens=512,
            messages=[{"role": "user", "content": summary_prompt}],
        )
        summary_text = response.content[0].text
    else:
        _model = model or settings.OLLAMA_FAST_MODEL
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": _model,
                    "messages": [{"role": "user", "content": summary_prompt}],
                    "stream": False,
                },
            )
            resp.raise_for_status()
            summary_text = resp.json()["message"]["content"]

    return [
        {"role": "assistant", "content": f"[Tóm tắt hội thoại trước]\n{summary_text}"}
    ] + recent_messages


# ---------------------------------------------------------------------------
# Non-streaming (dùng cho Zalo, WhatsApp, v.v.)
# ---------------------------------------------------------------------------
async def chat_once(
    system_prompt: str,
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 1024,
) -> str:
    if settings.AI_PROVIDER == "anthropic":
        _model = model or settings.ANTHROPIC_FAST_MODEL
        client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=_model,
            max_tokens=max_tokens,
            system=system_prompt,
            messages=messages,
        )
        return response.content[0].text
    else:
        _model = model or settings.OLLAMA_FAST_MODEL
        all_messages = [{"role": "system", "content": system_prompt}] + messages
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": _model,
                    "messages": all_messages,
                    "stream": False,
                    "keep_alive": "10m",
                    "options": {"num_predict": max_tokens},
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]


# ---------------------------------------------------------------------------
# Streaming generator
# ---------------------------------------------------------------------------
async def stream_chat(
    system_prompt: str,
    context_window: list[dict],
    user_message: str,
    model: str,
    db=None,
    user=None,
) -> AsyncGenerator[tuple[str, str], None]:
    """
    Yield (event_type, data) tuples:
      - ("tool_call", tool_name)
      - ("tool_result", result_text)
      - ("token", "...text...")
      - ("done", json_str)
      - ("error", "...message...")
    """
    if settings.AI_PROVIDER == "anthropic":
        async for event in _stream_anthropic(system_prompt, context_window, user_message, model, db, user):
            yield event
    else:
        async for event in _stream_ollama(system_prompt, context_window, user_message, model, db, user):
            yield event


# ---------------------------------------------------------------------------
# Anthropic streaming
# ---------------------------------------------------------------------------
async def _stream_anthropic(
    system_prompt: str,
    context_window: list[dict],
    user_message: str,
    model: str,
    db=None,
    user=None,
) -> AsyncGenerator[tuple[str, str], None]:
    from app.services.tools import TOOL_DEFINITIONS, execute_tool

    messages: list[dict] = list(context_window) + [
        {"role": "user", "content": user_message}
    ]
    total_input_tokens = 0
    total_output_tokens = 0

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    try:
        for _ in range(5):
            kwargs: dict = {
                "model": model,
                "max_tokens": 4096,
                "system": system_prompt,
                "messages": messages,
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
                total_input_tokens += final_msg.usage.input_tokens
                total_output_tokens += final_msg.usage.output_tokens

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
            messages.append({"role": "assistant", "content": assistant_content})

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
            messages.append({"role": "user", "content": tool_results})

        yield (
            "done",
            json.dumps({
                "model": model,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
            }),
        )

    except Exception as e:
        yield ("error", str(e))


# ---------------------------------------------------------------------------
# Ollama streaming
# ---------------------------------------------------------------------------
async def _stream_ollama(
    system_prompt: str,
    context_window: list[dict],
    user_message: str,
    model: str,
    db=None,
    user=None,
) -> AsyncGenerator[tuple[str, str], None]:
    from app.services.tools import TOOL_DEFINITIONS_OLLAMA, execute_tool

    messages: list[dict] = (
        [{"role": "system", "content": system_prompt}]
        + list(context_window)
        + [{"role": "user", "content": user_message}]
    )
    total_input_tokens = 0
    total_output_tokens = 0

    try:
        for _ in range(5):
            request_body: dict = {
                "model": model,
                "messages": messages,
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
                            total_input_tokens += chunk.get("prompt_eval_count", 0)
                            total_output_tokens += chunk.get("eval_count", 0)

            if not tool_calls or not db or not user:
                break

            messages.append({
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

                messages.append({"role": "tool", "content": result_text})

        yield (
            "done",
            json.dumps({
                "model": model,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
            }),
        )

    except Exception as e:
        yield ("error", str(e))
