-- ============================================================
-- 04_messages.sql
-- Lịch sử từng tin nhắn trong session.
-- tool_calls lưu thông tin khi AI gọi tool (Calendar, Gmail...).
-- ============================================================

CREATE TABLE messages (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID        NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,
        -- Giá trị hợp lệ: user | assistant | tool
    content     TEXT,
        -- Nội dung tin nhắn. NULL nếu là tool-only message.
    tool_calls  JSONB,
        -- Mảng các tool call:
        -- [{name, input, output, duration_ms, error}]
    token_count INTEGER     NOT NULL DEFAULT 0,
    model_used  VARCHAR(100),
        -- claude-haiku-4-5-20251001 | claude-sonnet-4-6
    latency_ms  INTEGER,
        -- Thời gian từ lúc gửi đến khi nhận token đầu tiên
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'tool')),
    CONSTRAINT messages_content_check CHECK (
        content IS NOT NULL OR tool_calls IS NOT NULL
    )
);

CREATE INDEX idx_messages_session ON messages (session_id, created_at);
