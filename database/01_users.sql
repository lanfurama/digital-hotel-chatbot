-- ============================================================
-- 01_users.sql
-- Bảng người dùng nội bộ. Dữ liệu đồng bộ từ Google SSO.
-- ============================================================

CREATE TABLE users (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    email       VARCHAR(200) NOT NULL,
    role        VARCHAR(50)  NOT NULL DEFAULT 'staff',
        -- Giá trị hợp lệ: admin | manager | staff
    department  VARCHAR(100),
    google_id   VARCHAR(200),
    avatar_url  TEXT,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_unique    UNIQUE (email),
    CONSTRAINT users_google_id_unique UNIQUE (google_id),
    CONSTRAINT users_role_check      CHECK (role IN ('admin', 'manager', 'staff'))
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_role   ON users (role);

-- Tự động cập nhật updated_at khi có thay đổi
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
