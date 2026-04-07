"""
AI Service: system prompt builder, model router, Anthropic streaming.
Không dùng LangChain — gọi Anthropic SDK trực tiếp.
"""
from __future__ import annotations

import re
from typing import AsyncGenerator

import anthropic

from app.core.config import settings

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
HAIKU_MODEL = "claude-haiku-4-5-20251001"
SONNET_MODEL = "claude-sonnet-4-6"

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
# Model router: Haiku cho câu đơn giản, Sonnet cho phân tích phức tạp
# ---------------------------------------------------------------------------
_SONNET_KEYWORDS = re.compile(
    r"lập kế hoạch|phân tích|tổng hợp|báo cáo|chiến lược|"
    r"so sánh|đánh giá|thiết kế|đề xuất|viết email|soạn thảo",
    re.IGNORECASE,
)


def route_model(user_message: str) -> str:
    if len(user_message) > 300 or _SONNET_KEYWORDS.search(user_message):
        return SONNET_MODEL
    return HAIKU_MODEL


# ---------------------------------------------------------------------------
# Context window: giữ tối đa 20 messages, summarize nếu quá dài
# ---------------------------------------------------------------------------
MAX_CONTEXT_MESSAGES = 20


async def maybe_summarize(
    context_window: list[dict],
    model: str = HAIKU_MODEL,
) -> list[dict]:
    """Nếu context > MAX, summarize nửa đầu bằng Haiku và giữ nửa sau."""
    if len(context_window) <= MAX_CONTEXT_MESSAGES:
        return context_window

    half = len(context_window) // 2
    old_messages = context_window[:half]
    recent_messages = context_window[half:]

    client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    summary_prompt = (
        "Tóm tắt ngắn gọn (5-10 câu) cuộc hội thoại sau, giữ lại các thông tin quan trọng:\n\n"
        + "\n".join(f"{m['role']}: {m['content']}" for m in old_messages)
    )
    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": summary_prompt}],
    )
    summary_text = response.content[0].text

    summary_msg = {
        "role": "assistant",
        "content": f"[Tóm tắt hội thoại trước]\n{summary_text}",
    }
    return [summary_msg] + recent_messages


# ---------------------------------------------------------------------------
# Streaming generator (with tool support)
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
      - ("tool_call", tool_name)       ← Claude đang gọi tool
      - ("tool_result", result_text)   ← kết quả tool
      - ("token", "...text...")
      - ("done", json_str)
      - ("error", "...message...")
    """
    from app.services.tools import TOOL_DEFINITIONS, execute_tool

    anthropic_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    messages: list[dict] = list(context_window) + [{"role": "user", "content": user_message}]

    total_input_tokens = 0
    total_output_tokens = 0

    try:
        # Vòng lặp: có thể gọi tool nhiều lần trước khi có câu trả lời cuối
        for _ in range(5):  # tối đa 5 lần tool call để tránh loop vô hạn
            # Stream lần này
            full_text = ""
            input_tokens = 0
            output_tokens = 0
            tool_uses: list[dict] = []
            stop_reason = "end_turn"

            async with anthropic_client.messages.stream(
                model=model,
                max_tokens=2048,
                system=system_prompt,
                tools=TOOL_DEFINITIONS if db and user else [],
                messages=messages,
            ) as stream:
                async for event in stream:
                    if not hasattr(event, "type"):
                        continue

                    if event.type == "content_block_start":
                        if hasattr(event, "content_block") and event.content_block.type == "tool_use":
                            tool_uses.append({
                                "id": event.content_block.id,
                                "name": event.content_block.name,
                                "input": {},
                            })
                            yield ("tool_call", event.content_block.name)

                    elif event.type == "content_block_delta":
                        delta = event.delta
                        if hasattr(delta, "text"):
                            full_text += delta.text
                            yield ("token", delta.text)
                        elif hasattr(delta, "partial_json") and tool_uses:
                            # Accumulate tool input JSON
                            tool_uses[-1]["_raw"] = tool_uses[-1].get("_raw", "") + delta.partial_json

                    elif event.type == "message_delta":
                        if hasattr(event, "usage"):
                            output_tokens = event.usage.output_tokens
                        if hasattr(event, "delta") and hasattr(event.delta, "stop_reason"):
                            stop_reason = event.delta.stop_reason or "end_turn"

                    elif event.type == "message_start":
                        if hasattr(event, "message") and hasattr(event.message, "usage"):
                            input_tokens = event.message.usage.input_tokens

            total_input_tokens += input_tokens
            total_output_tokens += output_tokens

            if stop_reason != "tool_use" or not tool_uses or not db or not user:
                # Không có tool call → xong
                break

            # Parse tool inputs và thực thi
            import json as _json
            assistant_content = []
            if full_text:
                assistant_content.append({"type": "text", "text": full_text})

            tool_results_content = []
            for tu in tool_uses:
                raw = tu.get("_raw", "{}")
                try:
                    tu["input"] = _json.loads(raw)
                except Exception:
                    tu["input"] = {}

                assistant_content.append({
                    "type": "tool_use",
                    "id": tu["id"],
                    "name": tu["name"],
                    "input": tu["input"],
                })

                result_text = await execute_tool(tu["name"], tu["input"], db, user)
                yield ("tool_result", result_text)

                tool_results_content.append({
                    "type": "tool_result",
                    "tool_use_id": tu["id"],
                    "content": result_text,
                })

            # Đưa assistant + tool results vào messages, tiếp tục vòng lặp
            messages.append({"role": "assistant", "content": assistant_content})
            messages.append({"role": "user", "content": tool_results_content})

        yield (
            "done",
            f'{{"model":"{model}","input_tokens":{total_input_tokens},"output_tokens":{total_output_tokens}}}',
        )

    except anthropic.APIError as e:
        yield ("error", str(e))
