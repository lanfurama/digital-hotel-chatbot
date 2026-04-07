"""
Zalo OA API client.
Gửi text message và lấy thông tin user qua Zalo Open API.
"""
import httpx

from app.core.config import settings

ZALO_API = "https://openapi.zalo.me/v2.0/oa"


async def send_text_message(follower_id: str, text: str) -> dict:
    """Gửi tin nhắn text về Zalo OA."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{ZALO_API}/message",
            headers={
                "access_token": settings.ZALO_ACCESS_TOKEN,
                "Content-Type": "application/json",
            },
            json={
                "recipient": {"user_id": follower_id},
                "message": {"text": text},
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_user_profile(follower_id: str) -> dict:
    """Lấy thông tin follower Zalo OA."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{ZALO_API}/getprofile",
            headers={"access_token": settings.ZALO_ACCESS_TOKEN},
            params={"user_id": follower_id},
        )
        resp.raise_for_status()
        return resp.json().get("data", {})
