-- ============================================================
-- 03_sessions.sql
-- Mỗi cuộc hội thoại là một session.
-- context_window lưu N messages gần nhất để đưa vào LLM.
-- client_id = NULL nghĩa là chat nội bộ (không phải widget).
-- ============================================================

CREATE TABLE sessions (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID         REFERENCES users (id) ON DELETE CASCADE,
        -- NULL nếu là anonymous visitor từ widget
    channel        VARCHAR(50)  NOT NULL,
        -- Giá trị hợp lệ: web | zalo | whatsapp | email | widget
    title          VARCHAR(500),
        -- Tự động tạo từ tin nhắn đầu tiên
    context_window JSONB        NOT NULL DEFAULT '[]',
        -- Mảng tối đa 20 messages: [{role, content}]
    token_count    INTEGER      NOT NULL DEFAULT 0,
    client_id      UUID         REFERENCES clients (id) ON DELETE CASCADE,
        -- NULL nếu là chat nội bộ, có giá trị nếu từ widget
    visitor_id     VARCHAR(200),
        -- UUID do widget JS tự tạo cho anonymous visitor
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT sessions_channel_check CHECK (
        channel IN ('web', 'zalo', 'whatsapp', 'email', 'widget')
    ),
    -- Một trong hai phải có giá trị
    CONSTRAINT sessions_identity_check CHECK (
        user_id IS NOT NULL OR visitor_id IS NOT NULL
    )
);

CREATE INDEX idx_sessions_user    ON sessions (user_id);
CREATE INDEX idx_sessions_client  ON sessions (client_id);
CREATE INDEX idx_sessions_updated ON sessions (updated_at DESC);

CREATE TRIGGER trg_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
