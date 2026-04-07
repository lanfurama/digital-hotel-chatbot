"""
Web crawler: crawl URL → extract text → chunk → embed → lưu vào doc_chunks.
Dùng BFS, giới hạn cùng domain, tối đa 50 trang.
"""
from __future__ import annotations

import asyncio
import logging
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse

import httpx

log = logging.getLogger(__name__)

MAX_PAGES = 50
CRAWL_TIMEOUT = 10.0
HEADERS = {"User-Agent": "HotelChatbot-Crawler/1.0"}


def _same_domain(base: str, url: str) -> bool:
    return urlparse(url).netloc == urlparse(base).netloc


def _extract_text(html: str) -> str:
    """Extract readable text từ HTML bằng regex đơn giản (không cần BeautifulSoup)."""
    # Xóa scripts và styles
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html, flags=re.DOTALL | re.IGNORECASE)
    # Xóa HTML tags
    text = re.sub(r"<[^>]+>", " ", html)
    # Decode common HTML entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">") \
               .replace("&nbsp;", " ").replace("&quot;", '"').replace("&#39;", "'")
    # Chuẩn hoá whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _extract_links(html: str, base_url: str) -> list[str]:
    """Lấy tất cả href links từ HTML."""
    hrefs = re.findall(r'href=["\']([^"\'#?]+)["\']', html, re.IGNORECASE)
    links = []
    for href in hrefs:
        full_url = urljoin(base_url, href).split("?")[0].split("#")[0]
        if full_url.startswith("http") and _same_domain(base_url, full_url):
            links.append(full_url)
    return links


def _get_title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    return re.sub(r"\s+", " ", match.group(1)).strip() if match else "Untitled"


async def crawl_and_index(
    client_id: uuid.UUID,
    start_url: str,
    crawl_job_id: uuid.UUID,
) -> None:
    """
    BFS crawl từ start_url, extract text, index vào knowledge base.
    Cập nhật crawl_job progress theo thời gian thực.
    """
    from app.core.database import AsyncSessionLocal
    from app.models.crawl import CrawlJob
    from app.models.knowledge import KnowledgeDoc
    from app.services.knowledge import chunk_text
    from app.services.embedding import embed_batch

    visited: set[str] = set()
    queue: list[str] = [start_url]
    pages_found = 0
    pages_done = 0

    async with AsyncSessionLocal() as db:
        # Mark job as running
        from sqlalchemy import select
        result = await db.execute(select(CrawlJob).where(CrawlJob.id == crawl_job_id))
        job = result.scalar_one_or_none()
        if not job:
            return
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

    async with httpx.AsyncClient(headers=HEADERS, timeout=CRAWL_TIMEOUT, follow_redirects=True) as http:
        while queue and pages_done < MAX_PAGES:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)

            try:
                resp = await http.get(url)
                if resp.status_code != 200:
                    continue

                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type:
                    continue

                html = resp.text
                text = _extract_text(html)
                title = _get_title(html)
                pages_found += 1

                if len(text) < 100:
                    continue

                # Tìm thêm links
                new_links = _extract_links(html, url)
                for link in new_links:
                    if link not in visited and link not in queue:
                        queue.append(link)

                # Index trang này
                await _index_page(client_id, url, title, text)
                pages_done += 1

                # Cập nhật progress
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(CrawlJob).where(CrawlJob.id == crawl_job_id))
                    job = result.scalar_one_or_none()
                    if job:
                        job.pages_found = pages_found
                        job.pages_done = pages_done
                        await db.commit()

                # Throttle để không DDoS site
                await asyncio.sleep(0.5)

            except Exception as e:
                log.warning(f"Crawl error {url}: {e}")
                continue

    # Mark job done
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CrawlJob).where(CrawlJob.id == crawl_job_id))
        job = result.scalar_one_or_none()
        if job:
            job.status = "done"
            job.finished_at = datetime.now(timezone.utc)
            job.pages_found = pages_found
            job.pages_done = pages_done
            await db.commit()

    log.info(f"Crawl done: {pages_done}/{pages_found} pages indexed for client {client_id}")


async def _index_page(client_id: uuid.UUID, url: str, title: str, text: str) -> None:
    """Tạo KnowledgeDoc + DocChunks cho một trang web."""
    from app.core.database import AsyncSessionLocal
    from app.models.knowledge import DocChunk, KnowledgeDoc
    from app.services.knowledge import chunk_text
    from app.services.embedding import embed_batch

    async with AsyncSessionLocal() as db:
        # Tạo hoặc cập nhật KnowledgeDoc
        from sqlalchemy import select
        result = await db.execute(
            select(KnowledgeDoc).where(
                KnowledgeDoc.source_url == url,
                KnowledgeDoc.client_id == client_id,
            )
        )
        doc = result.scalar_one_or_none()

        if doc:
            # Xoá chunks cũ
            from sqlalchemy import delete
            await db.execute(delete(DocChunk).where(DocChunk.doc_id == doc.id))
            doc.content_raw = text[:50_000]
            doc.updated_at = datetime.now(timezone.utc)
        else:
            doc = KnowledgeDoc(
                id=uuid.uuid4(),
                title=title,
                category="url",
                file_type="url",
                content_raw=text[:50_000],
                source_url=url,
                access_level="public",
                client_id=client_id,
                is_active=True,
            )
            db.add(doc)
            await db.flush()

        # Chunk + embed
        chunks = chunk_text(text)
        if not chunks:
            await db.commit()
            return

        embeddings = await embed_batch(chunks)
        db_chunks = [
            DocChunk(
                id=uuid.uuid4(),
                doc_id=doc.id,
                chunk_index=i,
                chunk_text=c,
                embedding=e,
                token_count=len(c) // 4,
            )
            for i, (c, e) in enumerate(zip(chunks, embeddings))
        ]
        db.add_all(db_chunks)
        await db.commit()
