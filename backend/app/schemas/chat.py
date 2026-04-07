import uuid
from datetime import datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: uuid.UUID | None = None


class MessageOut(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str | None
    model_used: str | None
    latency_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: uuid.UUID
    title: str | None
    channel: str
    token_count: int
    is_active: bool
    started_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
