"""
Claude tool definitions + executors.
Mỗi tool được định nghĩa theo Anthropic tool_use format.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.reminder import Reminder
from app.models.task import Task
from app.models.user import User

# ---------------------------------------------------------------------------
# Tool schemas (gửi cho Anthropic API)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "name": "create_task",
        "description": "Tạo một task/công việc mới trong hệ thống quản lý công việc. Dùng khi người dùng muốn tạo task, giao việc, hoặc ghi nhớ việc cần làm.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Tiêu đề task, ngắn gọn rõ ràng",
                },
                "description": {
                    "type": "string",
                    "description": "Mô tả chi tiết task (tuỳ chọn)",
                },
                "priority": {
                    "type": "string",
                    "enum": ["low", "medium", "high", "urgent"],
                    "description": "Mức độ ưu tiên. Mặc định: medium",
                },
                "due_date": {
                    "type": "string",
                    "description": "Hạn chót, định dạng YYYY-MM-DD (tuỳ chọn)",
                },
                "assigned_to_email": {
                    "type": "string",
                    "description": "Email người được giao (tuỳ chọn, để trống = tự giao cho mình)",
                },
            },
            "required": ["title"],
        },
    },
    {
        "name": "set_reminder",
        "description": "Đặt nhắc nhở cho người dùng tại một thời điểm cụ thể. Dùng khi người dùng muốn được nhắc về một việc gì đó.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Tiêu đề nhắc nhở",
                },
                "message": {
                    "type": "string",
                    "description": "Nội dung nhắc nhở chi tiết (tuỳ chọn)",
                },
                "remind_at": {
                    "type": "string",
                    "description": "Thời điểm nhắc, định dạng ISO 8601 (VD: 2025-01-15T09:00:00+07:00)",
                },
            },
            "required": ["title", "remind_at"],
        },
    },
    {
        "name": "read_calendar",
        "description": "Xem lịch Google Calendar của người dùng trong N ngày tới. Dùng khi được hỏi về lịch trình, cuộc họp, sự kiện sắp tới.",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "Số ngày muốn xem (1-30). Mặc định 7",
                    "default": 7,
                },
            },
        },
    },
    {
        "name": "send_email",
        "description": "Soạn và gửi email qua Gmail của người dùng. Chỉ dùng khi người dùng rõ ràng muốn gửi email.",
        "input_schema": {
            "type": "object",
            "properties": {
                "to": {
                    "type": "string",
                    "description": "Email người nhận",
                },
                "subject": {
                    "type": "string",
                    "description": "Tiêu đề email",
                },
                "body": {
                    "type": "string",
                    "description": "Nội dung email",
                },
            },
            "required": ["to", "subject", "body"],
        },
    },
    {
        "name": "create_spreadsheet",
        "description": "Tạo Google Spreadsheet mới để lưu báo cáo, danh sách, hoặc dữ liệu. Dùng khi người dùng muốn xuất dữ liệu ra Google Sheets.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "Tên spreadsheet",
                },
                "rows": {
                    "type": "array",
                    "items": {"type": "array"},
                    "description": "Dữ liệu dạng 2D array (hàng × cột)",
                },
            },
            "required": ["title", "rows"],
        },
    },
]


# Ollama/OpenAI format (convert từ TOOL_DEFINITIONS ở trên)
TOOL_DEFINITIONS_OLLAMA = [
    {
        "type": "function",
        "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        },
    }
    for t in TOOL_DEFINITIONS
]


# ---------------------------------------------------------------------------
# Tool executors
# ---------------------------------------------------------------------------

async def execute_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    db: AsyncSession,
    user: User,
) -> str:
    """Thực thi tool và trả về kết quả dạng string cho Claude."""
    try:
        if tool_name == "create_task":
            return await _create_task(tool_input, db, user)
        elif tool_name == "set_reminder":
            return await _set_reminder(tool_input, db, user)
        elif tool_name == "read_calendar":
            return await _read_calendar(tool_input, user)
        elif tool_name == "send_email":
            return await _send_email(tool_input, user)
        elif tool_name == "create_spreadsheet":
            return await _create_spreadsheet(tool_input, user)
        else:
            return f"Tool '{tool_name}' không được hỗ trợ."
    except Exception as e:
        return f"Lỗi khi thực thi tool {tool_name}: {str(e)}"


async def _create_task(inp: dict, db: AsyncSession, user: User) -> str:
    from datetime import date

    due_date = None
    if inp.get("due_date"):
        try:
            due_date = date.fromisoformat(inp["due_date"])
        except ValueError:
            pass

    task = Task(
        id=uuid.uuid4(),
        title=inp["title"],
        description=inp.get("description"),
        priority=inp.get("priority", "medium"),
        due_date=due_date,
        created_by=user.id,
        assigned_to=user.id,  # giao cho chính mình nếu không chỉ định
    )
    db.add(task)
    await db.commit()

    due_str = f", hạn: {due_date}" if due_date else ""
    return f"Đã tạo task: '{task.title}' (ID: {task.id}, priority: {task.priority}{due_str})"


async def _set_reminder(inp: dict, db: AsyncSession, user: User) -> str:
    remind_at = datetime.fromisoformat(inp["remind_at"])
    if remind_at.tzinfo is None:
        remind_at = remind_at.replace(tzinfo=timezone.utc)

    reminder = Reminder(
        id=uuid.uuid4(),
        user_id=user.id,
        title=inp["title"],
        message=inp.get("message"),
        remind_at=remind_at,
        channels=["web"],
    )
    db.add(reminder)
    await db.commit()

    return f"Đã đặt nhắc nhở: '{reminder.title}' vào lúc {remind_at.strftime('%H:%M %d/%m/%Y')}"


async def _read_calendar(inp: dict, user: User) -> str:
    from app.services.google import read_calendar

    days = int(inp.get("days", 7))
    events = await read_calendar(user, days=days)

    if not events:
        return f"Không có sự kiện nào trong {days} ngày tới."

    lines = [f"Lịch {days} ngày tới ({len(events)} sự kiện):"]
    for e in events:
        lines.append(f"- {e['title']} | {e['start']}" + (f" | {e['location']}" if e.get("location") else ""))
    return "\n".join(lines)


async def _send_email(inp: dict, user: User) -> str:
    from app.services.google import send_email

    result = await send_email(user, inp["to"], inp["subject"], inp["body"])
    return f"Đã gửi email đến {inp['to']}. Message ID: {result.get('message_id')}"


async def _create_spreadsheet(inp: dict, user: User) -> str:
    from app.services.google import create_spreadsheet

    result = await create_spreadsheet(user, inp["title"], inp.get("rows", []))
    return f"Đã tạo spreadsheet '{inp['title']}': {result['url']}"
