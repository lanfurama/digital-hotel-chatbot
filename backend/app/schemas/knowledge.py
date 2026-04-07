import uuid
from datetime import datetime

from pydantic import BaseModel


class KnowledgeDocOut(BaseModel):
    id: uuid.UUID
    title: str
    category: str
    file_type: str | None
    access_level: str
    tags: list[str] | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    chunk_text: str
    title: str
    category: str
    source_url: str | None
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
