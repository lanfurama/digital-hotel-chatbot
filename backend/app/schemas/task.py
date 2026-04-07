import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    type: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    type: str | None
    status: str
    start_date: date | None
    end_date: date | None
    owner_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    status: str = "todo"
    priority: str = "medium"
    due_date: date | None = None
    project_id: uuid.UUID | None = None
    assigned_to: uuid.UUID | None = None
    tags: list[str] | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: date | None = None
    assigned_to: uuid.UUID | None = None
    tags: list[str] | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    priority: str
    due_date: date | None
    project_id: uuid.UUID | None
    created_by: uuid.UUID | None
    assigned_to: uuid.UUID | None
    tags: list[str] | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReminderCreate(BaseModel):
    title: str
    message: str | None = None
    remind_at: datetime
    task_id: uuid.UUID | None = None
    channels: list[str] = ["web"]


class ReminderOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    task_id: uuid.UUID | None
    title: str
    message: str | None
    remind_at: datetime
    channels: list[str]
    is_sent: bool
    created_at: datetime

    model_config = {"from_attributes": True}
