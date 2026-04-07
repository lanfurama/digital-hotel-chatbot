"""
Google Calendar, Gmail, Sheets integration.
Token được lưu trong bảng users (google_access_token / google_refresh_token).
"""
from __future__ import annotations

from datetime import datetime, timezone

import httpx

from app.core.config import settings


async def _get_valid_token(user) -> str:
    """Trả về access token hợp lệ, tự refresh nếu cần."""
    if not user.google_access_token:
        raise ValueError("Người dùng chưa kết nối Google. Vui lòng đăng nhập lại.")

    # Kiểm tra expiry (nếu còn > 5 phút thì dùng luôn)
    if user.google_token_expiry and user.google_token_expiry > datetime.now(timezone.utc):
        # Còn hạn: trả về token hiện tại
        # (Thực tế cần check trừ 5 phút để tránh race condition, đơn giản hoá ở đây)
        return user.google_access_token

    # Refresh token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "refresh_token": user.google_refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        data = resp.json()

    # Cập nhật token trong DB (caller cần commit)
    user.google_access_token = data["access_token"]
    if "refresh_token" in data:
        user.google_refresh_token = data["refresh_token"]
    from datetime import timedelta
    user.google_token_expiry = datetime.now(timezone.utc) + timedelta(
        seconds=data.get("expires_in", 3600)
    )
    return user.google_access_token


# ---------------------------------------------------------------------------
# Google Calendar
# ---------------------------------------------------------------------------

async def read_calendar(user, days: int = 7) -> list[dict]:
    """Lấy sự kiện calendar trong N ngày tới."""
    token = await _get_valid_token(user)
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    time_max = now + timedelta(days=days)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "timeMin": now.isoformat(),
                "timeMax": time_max.isoformat(),
                "singleEvents": "true",
                "orderBy": "startTime",
                "maxResults": 20,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    events = []
    for item in data.get("items", []):
        start = item.get("start", {})
        events.append({
            "id": item.get("id"),
            "title": item.get("summary", "(Không có tiêu đề)"),
            "start": start.get("dateTime") or start.get("date"),
            "location": item.get("location"),
            "description": item.get("description"),
        })
    return events


async def create_calendar_event(user, title: str, start: str, end: str, description: str = "") -> dict:
    """Tạo sự kiện mới trên Google Calendar."""
    token = await _get_valid_token(user)

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "summary": title,
                "description": description,
                "start": {"dateTime": start, "timeZone": "Asia/Ho_Chi_Minh"},
                "end": {"dateTime": end, "timeZone": "Asia/Ho_Chi_Minh"},
            },
        )
        resp.raise_for_status()
        return resp.json()


# ---------------------------------------------------------------------------
# Gmail
# ---------------------------------------------------------------------------

import base64
import email.mime.text


async def send_email(user, to: str, subject: str, body: str) -> dict:
    """Soạn và gửi email qua Gmail API."""
    token = await _get_valid_token(user)

    msg = email.mime.text.MIMEText(body, "plain", "utf-8")
    msg["to"] = to
    msg["subject"] = subject
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={"Authorization": f"Bearer {token}"},
            json={"raw": raw},
        )
        resp.raise_for_status()
        return {"message_id": resp.json().get("id"), "status": "sent"}


# ---------------------------------------------------------------------------
# Google Sheets
# ---------------------------------------------------------------------------

async def create_spreadsheet(user, title: str, rows: list[list]) -> dict:
    """Tạo Google Spreadsheet mới với dữ liệu cho sẵn."""
    token = await _get_valid_token(user)

    async with httpx.AsyncClient() as client:
        # Tạo spreadsheet
        create_resp = await client.post(
            "https://sheets.googleapis.com/v4/spreadsheets",
            headers={"Authorization": f"Bearer {token}"},
            json={"properties": {"title": title}},
        )
        create_resp.raise_for_status()
        sheet_id = create_resp.json()["spreadsheetId"]
        sheet_url = create_resp.json()["spreadsheetUrl"]

        if rows:
            # Ghi dữ liệu vào sheet
            await client.put(
                f"https://sheets.googleapis.com/v4/spreadsheets/{sheet_id}/values/A1",
                headers={"Authorization": f"Bearer {token}"},
                params={"valueInputOption": "RAW"},
                json={"values": rows},
            )

    return {"spreadsheet_id": sheet_id, "url": sheet_url}
