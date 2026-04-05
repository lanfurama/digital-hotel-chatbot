-- ============================================================
-- 00_extensions.sql
-- Cài đặt các PostgreSQL extensions cần thiết
-- Chạy với user có quyền SUPERUSER (thường là postgres)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "vector";      -- Vector similarity search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- AES-256 encryption
