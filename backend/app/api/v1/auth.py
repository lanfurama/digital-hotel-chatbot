import uuid
from datetime import datetime, timezone
from typing import Annotated

from authlib.integrations.httpx_client import AsyncOAuth2Client
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser
from app.core.security import create_access_token, create_refresh_token, verify_refresh_token
from app.models.user import User
from app.schemas.auth import AuthResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

GOOGLE_CONF_URL = "https://accounts.google.com/.well-known/openid-configuration"
COOKIE_OPTS = {
    "httponly": True,
    "secure": settings.APP_ENV == "production",
    "samesite": "lax",
}


def _set_tokens(response: Response, user_id: str) -> str:
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie("access_token", access_token, max_age=900, **COOKIE_OPTS)
    response.set_cookie(
        "refresh_token", refresh_token, max_age=60 * 60 * 24 * 7, **COOKIE_OPTS
    )
    return access_token


@router.get("/google")
async def google_login():
    """Trả về URL để redirect người dùng sang Google OAuth."""
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        scope="openid email profile",
    )
    uri, _ = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/v2/auth",
        access_type="offline",
    )
    return {"url": uri}


@router.get("/google/callback")
async def google_callback(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Xử lý callback từ Google, tạo/cập nhật user, set cookies rồi redirect về frontend."""
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
    )

    try:
        token_data = await client.fetch_token(
            "https://oauth2.googleapis.com/token", code=code
        )
        userinfo_resp = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
        userinfo = userinfo_resp.json()
    except Exception:
        return RedirectResponse(f"{settings.FRONTEND_URL}/login?error=oauth_failed")

    google_id = userinfo["sub"]
    email = userinfo["email"]
    name = userinfo.get("name", email)
    avatar_url = userinfo.get("picture")

    result = await db.execute(
        select(User).where(
            (User.google_id == google_id) | (User.email == email)
        )
    )
    user = result.scalar_one_or_none()

    from datetime import timedelta
    token_expiry = datetime.now(timezone.utc) + timedelta(
        seconds=token_data.get("expires_in", 3600)
    )

    if user:
        user.google_id = google_id
        user.avatar_url = avatar_url
        user.last_login = datetime.now(timezone.utc)
        user.google_access_token = token_data.get("access_token")
        user.google_refresh_token = token_data.get("refresh_token") or user.google_refresh_token
        user.google_token_expiry = token_expiry
    else:
        user = User(
            id=uuid.uuid4(),
            name=name,
            email=email,
            google_id=google_id,
            avatar_url=avatar_url,
            role="staff",
            last_login=datetime.now(timezone.utc),
            google_access_token=token_data.get("access_token"),
            google_refresh_token=token_data.get("refresh_token"),
            google_token_expiry=token_expiry,
        )
        db.add(user)

    await db.flush()
    await db.commit()

    redirect = RedirectResponse(f"{settings.FRONTEND_URL}/chat", status_code=302)
    _set_tokens(redirect, str(user.id))
    return redirect


@router.post("/refresh")
async def refresh_token(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[str | None, Cookie()] = None,
):
    """Dùng refresh token để lấy access token mới."""
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Không có refresh token")

    user_id = verify_refresh_token(refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")

    try:
        user_uuid = uuid.UUID(user_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Refresh token không hợp lệ")
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Người dùng không hợp lệ")

    access_token = _set_tokens(response, user_id)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Đã đăng xuất"}


@router.get("/me")
async def me(current_user: CurrentUser):
    return UserOut.model_validate(current_user)
