import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.task import Project, Task
from app.schemas.task import ProjectCreate, ProjectOut, TaskCreate, TaskOut, TaskUpdate

router = APIRouter(tags=["tasks"])

# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

@router.get("/projects", response_model=list[ProjectOut])
async def list_projects(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Project).where(Project.status != "archived").order_by(Project.created_at.desc())
    )
    return [ProjectOut.model_validate(p) for p in result.scalars().all()]


@router.post("/projects", response_model=ProjectOut)
async def create_project(
    body: ProjectCreate,
    current_user: Annotated[CurrentUser, require_role("manager")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    project = Project(id=uuid.uuid4(), **body.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@router.get("/tasks", response_model=list[TaskOut])
async def list_tasks(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    project_id: uuid.UUID | None = None,
    assigned_to_me: bool = False,
):
    stmt = select(Task)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    if assigned_to_me:
        stmt = stmt.where(Task.assigned_to == current_user.id)
    stmt = stmt.where(Task.status != "cancelled").order_by(Task.created_at.desc())
    result = await db.execute(stmt)
    return [TaskOut.model_validate(t) for t in result.scalars().all()]


@router.post("/tasks", response_model=TaskOut)
async def create_task(
    body: TaskCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    task = Task(id=uuid.uuid4(), **body.model_dump(), created_by=current_user.id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task không tồn tại")
    return TaskOut.model_validate(task)


@router.put("/tasks/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task không tồn tại")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(404, "Task không tồn tại")
    task.status = "cancelled"
    await db.commit()
    return {"message": "Đã huỷ task"}
