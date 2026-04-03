-- ============================================================
-- 05_knowledge.sql
-- knowledge_docs: tài liệu gốc (PDF/DOCX/XLSX/URL)
-- doc_chunks:     tài liệu đã cắt nhỏ + vector embedding
--
-- client_id = NULL  → tài liệu nội bộ (dùng cho internal chat)
-- client_id = <id>  → tài liệu của website widget đó
-- ============================================================

-- ------------------------------------------------------------
-- Tài liệu gốc
-- ------------------------------------------------------------
CREATE TABLE knowledge_docs (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    title        VARCHAR(500) NOT NULL,
    category     VARCHAR(100) NOT NULL,
        -- Giá trị hợp lệ: policy | package | regulation | sop | faq | other
    file_path    TEXT,
        -- Path trong Cloudflare R2 (NULL nếu source là URL)
    file_type    VARCHAR(20),
        -- pdf | docx | xlsx | md | url
    content_raw  TEXT,
        -- Full text đã extract (dùng để re-embed khi cần)
    source_url   TEXT,
        -- URL nguồn nếu tài liệu học từ website (widget mode)
    access_level VARCHAR(50)  NOT NULL DEFAULT 'staff',
        -- Giá trị hợp lệ: public | staff | manager | admin
        -- public: widget anonymous visitor cũng đọc được
    client_id    UUID         REFERENCES clients (id) ON DELETE CASCADE,
        -- NULL nếu là tài liệu nội bộ
    tags         TEXT[]       NOT NULL DEFAULT '{}',
    created_by   UUID         REFERENCES users (id) ON DELETE SET NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT FALSE,
        -- FALSE trong lúc đang process, TRUE khi xong
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT knowledge_docs_category_check CHECK (
        category IN ('policy', 'package', 'regulation', 'sop', 'faq', 'other')
    ),
    CONSTRAINT knowledge_docs_access_check CHECK (
        access_level IN ('public', 'staff', 'manager', 'admin')
    ),
    CONSTRAINT knowledge_docs_filetype_check CHECK (
        file_type IN ('pdf', 'docx', 'xlsx', 'md', 'url')
    )
);

CREATE INDEX idx_knowledge_docs_client   ON knowledge_docs (client_id);
CREATE INDEX idx_knowledge_docs_category ON knowledge_docs (category) WHERE is_active = TRUE;
CREATE INDEX idx_knowledge_docs_active   ON knowledge_docs (is_active, access_level);

CREATE TRIGGER trg_knowledge_docs_updated_at
    BEFORE UPDATE ON knowledge_docs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
-- Chunks + vector embeddings
-- Tài liệu được cắt thành chunks 512 tokens, overlap 64 tokens.
-- Mỗi chunk có embedding 768 chiều từ nomic-embed-text.
-- ------------------------------------------------------------
CREATE TABLE doc_chunks (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_id      UUID        NOT NULL REFERENCES knowledge_docs (id) ON DELETE CASCADE,
    chunk_index INTEGER     NOT NULL,
        -- Thứ tự chunk trong tài liệu, bắt đầu từ 0
    chunk_text  TEXT        NOT NULL,
    embedding   vector(768),
        -- nomic-embed-text output dimension = 768
        -- NULL trong lúc đang embed, có giá trị khi xong
    token_count INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT doc_chunks_index_unique UNIQUE (doc_id, chunk_index)
);

-- HNSW index để approximate nearest neighbor search
-- m=16: số cạnh mỗi node, ef_construction=64: độ chính xác lúc build
-- Trade-off: build chậm hơn IVFFlat nhưng query nhanh hơn và chính xác hơn
CREATE INDEX idx_doc_chunks_embedding ON doc_chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_doc_chunks_doc ON doc_chunks (doc_id, chunk_index);
