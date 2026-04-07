"""
In-memory TTL cache cho embedding vectors.
Tránh gọi Ollama nhiều lần cho cùng một query text.
Không dùng Redis — giữ đúng thiết kế "no extra services".
"""
import hashlib
import time
from collections import OrderedDict
from typing import Any

_DEFAULT_TTL = 3600   # 1 giờ
_DEFAULT_MAX = 1024   # tối đa 1024 entries (~4MB nếu mỗi vector 768×4 bytes)


class TTLCache:
    """LRU + TTL cache thread-safe cho asyncio (single-thread event loop)."""

    def __init__(self, maxsize: int = _DEFAULT_MAX, ttl: int = _DEFAULT_TTL):
        self._maxsize = maxsize
        self._ttl = ttl
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()

    def _make_key(self, text: str) -> str:
        return hashlib.sha256(text.encode()).hexdigest()

    def get(self, text: str) -> list[float] | None:
        key = self._make_key(text)
        if key not in self._store:
            return None
        value, expires_at = self._store[key]
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        # Move to end (LRU)
        self._store.move_to_end(key)
        return value

    def set(self, text: str, vector: list[float]) -> None:
        key = self._make_key(text)
        if key in self._store:
            self._store.move_to_end(key)
        self._store[key] = (vector, time.monotonic() + self._ttl)
        # Evict oldest nếu vượt maxsize
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    def clear(self) -> None:
        self._store.clear()

    def stats(self) -> dict:
        now = time.monotonic()
        valid = sum(1 for _, (_, exp) in self._store.items() if exp > now)
        return {"size": len(self._store), "valid": valid, "maxsize": self._maxsize, "ttl": self._ttl}


# Singleton cache dùng cho embedding service
embedding_cache = TTLCache(maxsize=2048, ttl=3600)
