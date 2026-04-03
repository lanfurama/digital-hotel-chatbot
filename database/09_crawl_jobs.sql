-- ============================================================
-- 09_crawl_jobs.sql
-- Theo dõi tiến trình crawl website cho embed widget.
-- Mỗi lần admin trigger crawl một URL là một crawl_job.
-- ============================================================

CREATE TABLE crawl_jobs (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id   UUID         NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
    url         TEXT         NOT NULL,
        -- URL gốc được crawl (có thể là root URL, crawler tự tìm sub-pages)
    status      VARCHAR(50)  NOT NULL DEFAULT 'pending',
        -- pending | running | done | failed
    max_pages   INTEGER      NOT NULL DEFAULT 50,
    pages_found INTEGER      NOT NULL DEFAULT 0,
    pages_done  INTEGER      NOT NULL DEFAULT 0,
    error       TEXT,
        -- Thông tin lỗi nếu status = failed
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT crawl_jobs_status_check CHECK (
        status IN ('pending', 'running', 'done', 'failed')
    ),
    CONSTRAINT crawl_jobs_max_pages_check CHECK (max_pages BETWEEN 1 AND 500)
);

CREATE INDEX idx_crawl_jobs_client ON crawl_jobs (client_id, created_at DESC);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs (status) WHERE status IN ('pending', 'running');
