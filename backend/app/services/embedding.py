import httpx

from app.core.cache import embedding_cache
from app.core.config import settings

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


async def embed_text(text: str) -> list[float]:
    """Gọi Ollama để lấy embedding vector. Cache hit tránh gọi lại Ollama."""
    cached = embedding_cache.get(text)
    if cached is not None:
        return cached

    client = get_http_client()
    response = await client.post(
        f"{settings.OLLAMA_BASE_URL}/api/embeddings",
        json={"model": settings.OLLAMA_EMBED_MODEL, "prompt": text},
    )
    response.raise_for_status()
    vector = response.json()["embedding"]
    embedding_cache.set(text, vector)
    return vector


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed nhiều đoạn text, gọi tuần tự (Ollama không hỗ trợ batch native)."""
    results = []
    for text in texts:
        vec = await embed_text(text)
        results.append(vec)
    return results
