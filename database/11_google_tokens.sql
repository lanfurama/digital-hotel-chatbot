-- ============================================================
-- 11_google_tokens.sql
-- Lưu Google OAuth tokens cho Calendar / Gmail / Sheets.
-- Chạy migration này sau khi schema ban đầu đã được tạo.
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS google_access_token  TEXT,
    ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS google_token_expiry   TIMESTAMPTZ;
