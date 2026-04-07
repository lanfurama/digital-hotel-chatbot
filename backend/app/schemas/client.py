import uuid
from datetime import datetime

from pydantic import BaseModel


class ClientCreate(BaseModel):
    name: str
    domain: str
    widget_color: str = "#534AB7"


class ClientOut(BaseModel):
    id: uuid.UUID
    name: str
    domain: str | None
    api_key: str
    widget_color: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
