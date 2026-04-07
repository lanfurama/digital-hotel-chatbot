import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, require_role
from app.models.knowledge import KnowledgeDoc
from app.schemas.knowledge import KnowledgeDocOut, SearchResponse
from app.services.knowledge import process_and_store, rag_search

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

ALLOWED_TYPES = {"pdf", "docx", "xlsx", "md", "txt"}
ROLES_ACCESS = {"admin": ["public", "staff", "manager", "admin"],
                "manager": ["public", "staff", "manager"],
                "staff": ["public", "staff"]}


@router.post("/upload", response_model=KnowledgeDocOut)
async def upload_document(
    current_user: Annotated[CurrentUser, require_role("staff")],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form(...),
    access_level: str = Form("staff"),
    tags: str = Form(""),
):
    ext = Path(file.filename or "").suffix.lstrip(".").lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type không hỗ trợ. Chấp nhận: {', '.join(ALLOWED_TYPES)}")

    data = await file.read()

    doc = KnowledgeDoc(
        id=uuid.uuid4(),
        title=title,
        category=category,
        file_type=ext,
        access_level=access_level,
        tags=[t.strip() for t in tags.split(",") if t.strip()] or None,
        created_by=current_user.id,
    )
    db.add(doc)
    await db.flush()

    chunk_count = await process_and_store(db, doc, data, ext)
    await db.commit()
    await db.refresh(doc)

    return KnowledgeDocOut.model_validate(doc)


@router.get("/search", response_model=SearchResponse)
async def search_knowledge(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(..., min_length=2),
    limit: int = Query(5, le=10),
):
    allowed_levels = ROLES_ACCESS.get(current_user.role, ["public", "staff"])
    results = await rag_search(db, q, allowed_levels, limit=limit)
    return SearchResponse(query=q, results=results)


@router.get("/docs", response_model=list[KnowledgeDocOut])
async def list_docs(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    category: str | None = None,
):
    allowed_levels = ROLES_ACCESS.get(current_user.role, ["public", "staff"])
    stmt = select(KnowledgeDoc).where(
        KnowledgeDoc.is_active == True,
        KnowledgeDoc.access_level.in_(allowed_levels),
    )
    if category:
        stmt = stmt.where(KnowledgeDoc.category == category)
    result = await db.execute(stmt)
    docs = result.scalars().all()
    return [KnowledgeDocOut.model_validate(d) for d in docs]


@router.delete("/docs/{doc_id}", dependencies=[require_role("manager")])
async def delete_doc(
    doc_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(KnowledgeDoc).where(KnowledgeDoc.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Không tìm thấy tài liệu")
    doc.is_active = False
    await db.commit()
    return {"message": "Đã xóa tài liệu"}
