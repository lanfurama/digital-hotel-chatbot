# Thiết kế Database

## 1. Tổng quan

Sử dụng **PostgreSQL 16** với extension **pgvector** làm database duy nhất. pgvector cho phép lưu và tìm kiếm vector embeddings ngay trong PostgreSQL — không cần Pinecone/Qdrant.

### Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgvector";   -- Vector similarity search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- AES-256 encryption
```

---

## 2. Schema

### 2.1 users

```sql
CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(200) NOT NULL,
  email        VARCHAR(200) UNIQUE NOT NULL,
  role         VARCHAR(50)  NOT NULL DEFAULT 'staff',  -- admin | manager | staff
  department   VARCHAR(100),
  google_id    VARCHAR(200) UNIQUE,
  avatar_url   TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);
```

### 2.2 sessions

Mỗi cuộc hội thoại là một session. `context_window` lưu N messages gần nhất để đưa vào LLM context.

```sql
CREATE TABLE sessions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel        VARCHAR(50) NOT NULL,   -- web | zalo | whatsapp | email | widget
  title          VARCHAR(500),           -- Auto-generated từ message đầu tiên
  context_window JSONB DEFAULT '[]',    -- Tối đa 20 messages gần nhất
  token_count    INTEGER DEFAULT 0,
  client_id      UUID REFERENCES clients(id),  -- NULL nếu là internal chat
  is_active      BOOLEAN DEFAULT TRUE,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
```

### 2.3 messages

```sql
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL,   -- user | assistant | tool
  content     TEXT,
  tool_calls  JSONB,                  -- [{name, input, output, duration_ms}]
  token_count INTEGER DEFAULT 0,
  model_used  VARCHAR(100),           -- claude-haiku-4-5 | claude-sonnet-4-6
  latency_ms  INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### 2.4 knowledge_docs

```sql
CREATE TABLE knowledge_docs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(500) NOT NULL,
  category     VARCHAR(100) NOT NULL,   -- policy | package | regulation | sop | faq | other
  file_path    TEXT,                    -- Path trong Cloudflare R2
  file_type    VARCHAR(20),             -- pdf | docx | xlsx | md | url
  content_raw  TEXT,                    -- Extracted text
  source_url   TEXT,                    -- Nếu học từ website (widget mode)
  access_level VARCHAR(50) DEFAULT 'staff',  -- public | staff | manager | admin
  client_id    UUID REFERENCES clients(id),  -- NULL nếu là tài liệu nội bộ
  tags         TEXT[],
  created_by   UUID REFERENCES users(id),
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.5 doc_chunks

Tài liệu được cắt thành chunks 512 tokens, mỗi chunk có embedding 768 chiều.

```sql
CREATE TABLE doc_chunks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id      UUID NOT NULL REFERENCES knowledge_docs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text  TEXT NOT NULL,
  embedding   vector(768),    -- nomic-embed-text output dimension
  token_count INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index: fast approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON doc_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

### 2.6 tasks

```sql
CREATE TABLE tasks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  status       VARCHAR(50) DEFAULT 'todo',     -- todo | in_progress | review | done | cancelled
  priority     VARCHAR(20) DEFAULT 'medium',   -- low | medium | high | urgent
  due_date     DATE,
  project_id   UUID REFERENCES projects(id),
  created_by   UUID REFERENCES users(id),
  assigned_to  UUID REFERENCES users(id),
  tags         TEXT[],
  metadata     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tasks_assigned ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_due      ON tasks(due_date) WHERE status != 'done';
```

### 2.7 projects

```sql
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(300) NOT NULL,
  description TEXT,
  type        VARCHAR(100),   -- marketing | sales | operations | event
  status      VARCHAR(50) DEFAULT 'active',
  start_date  DATE,
  end_date    DATE,
  owner_id    UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.8 reminders

```sql
CREATE TABLE reminders (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id),
  task_id    UUID REFERENCES tasks(id),
  title      VARCHAR(500) NOT NULL,
  message    TEXT,
  remind_at  TIMESTAMPTZ NOT NULL,
  channels   TEXT[] DEFAULT '{web}',   -- web | zalo | email
  is_sent    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reminders_due ON reminders(remind_at) WHERE is_sent = FALSE;
```

### 2.9 audit_logs

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,   -- login | query | doc_upload | task_create | ...
  resource_type VARCHAR(100),
  resource_id   UUID,
  metadata      JSONB DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  response_code INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only: không UPDATE/DELETE bảng này
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at DESC);
```

### 2.10 clients *(Widget mode)*

```sql
CREATE TABLE clients (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(200) NOT NULL,
  domain       VARCHAR(500),           -- Website domain được phép dùng widget
  api_key      VARCHAR(200) UNIQUE NOT NULL,
  widget_color VARCHAR(20) DEFAULT '#534AB7',
  is_active    BOOLEAN DEFAULT TRUE,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.11 crawl_jobs *(Widget mode)*

```sql
CREATE TABLE crawl_jobs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id),
  url         TEXT NOT NULL,
  status      VARCHAR(50) DEFAULT 'pending',  -- pending | running | done | failed
  pages_found INTEGER DEFAULT 0,
  pages_done  INTEGER DEFAULT 0,
  error       TEXT,
  started_at  TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Chiến lược

### 3.1 Chunking

- Chunk size: **512 tokens**, overlap: **64 tokens**
- Mỗi chunk giữ metadata: `doc_id`, `title`, `page_number`, `section`
- Re-embed tự động khi tài liệu được cập nhật

### 3.2 Context window management

- Giữ tối đa **20 messages** gần nhất trong `context_window` JSONB
- Nếu session dài hơn → summarize messages cũ bằng Claude Haiku
- Token budget mỗi request: `system + history + query + RAG chunks ≤ 8000 tokens`

### 3.3 RAG search query

```sql
SELECT
  dc.chunk_text,
  kd.title,
  kd.category,
  kd.source_url,
  1 - (dc.embedding <=> $1) AS score
FROM doc_chunks dc
JOIN knowledge_docs kd ON dc.doc_id = kd.id
WHERE kd.is_active = TRUE
  AND kd.access_level = ANY($2)           -- filter theo role
  AND (kd.client_id = $3 OR kd.client_id IS NULL)  -- filter theo client
ORDER BY dc.embedding <=> $1
LIMIT 5;
-- Chỉ dùng chunks có score > 0.7
```

### 3.4 Retention policy

| Bảng | Retention | Lý do |
|---|---|---|
| messages | 90 ngày | Tiết kiệm storage |
| audit_logs | 1 năm | Compliance |
| sessions | 90 ngày nếu inactive | Auto-archive |
| doc_chunks | Vô hạn | Cần cho RAG |
| reminders | 30 ngày sau khi sent | Auto-cleanup |

### 3.5 Backup

- `pg_dump` daily lúc 2:00 AM → Cloudflare R2
- Giữ 7 ngày rolling backup
- Hetzner snapshot hàng tuần
