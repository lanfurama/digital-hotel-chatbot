-- ============================================================
-- 02_clients.sql
-- Mỗi client là một website bên ngoài dùng embed widget.
-- Phải tạo trước sessions và knowledge_docs vì 2 bảng đó
-- có foreign key vào clients.
-- ============================================================

CREATE TABLE clients (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         VARCHAR(200) NOT NULL,
    domain       VARCHAR(500),
        -- Domain được phép gọi widget (dùng để validate Origin header)
        -- Ví dụ: https://www.khachsan.com
    api_key      VARCHAR(200) NOT NULL,
    widget_color VARCHAR(20)  NOT NULL DEFAULT '#534AB7',
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by   UUID         REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT clients_api_key_unique UNIQUE (api_key)
);

CREATE INDEX idx_clients_api_key ON clients (api_key);
