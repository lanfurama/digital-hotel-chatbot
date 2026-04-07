from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.middleware.audit import AuditMiddleware
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.security import SecurityHeadersMiddleware
from app.services.scheduler import start_scheduler, stop_scheduler

# Cấu hình logging sớm nhất có thể
setup_logging(app_env=settings.APP_ENV)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="Hotel Chatbot API",
    version="1.0.0",
    docs_url="/api/docs" if settings.APP_ENV != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)

# Middleware (thứ tự quan trọng: outer → inner)
app.add_middleware(SecurityHeadersMiddleware, production=(settings.APP_ENV == "production"))
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "X-Widget-Key"],
)

app.include_router(api_router)

# Serve widget.js
_STATIC_DIR = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")


@app.get("/widget.js", include_in_schema=False)
async def serve_widget():
    return FileResponse(_STATIC_DIR / "widget.js", media_type="application/javascript")


@app.get("/health")
async def health():
    return {"status": "ok", "env": settings.APP_ENV, "version": "1.0.0"}


@app.get("/health/detailed")
async def health_detailed():
    """Health check đầy đủ: DB + Ollama. Dùng cho monitoring / rollback."""
    import httpx
    from sqlalchemy import text
    from app.core.database import AsyncSessionLocal

    checks: dict = {}

    # Database
    try:
        async with AsyncSessionLocal() as db:
            await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {e}"

    # Ollama
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            resp.raise_for_status()
        checks["ollama"] = "ok"
    except Exception as e:
        checks["ollama"] = f"error: {e}"

    # Embedding cache stats
    from app.core.cache import embedding_cache
    checks["embedding_cache"] = embedding_cache.stats()

    all_ok = all(v == "ok" for k, v in checks.items() if isinstance(v, str))
    return {"status": "ok" if all_ok else "degraded", "checks": checks}
