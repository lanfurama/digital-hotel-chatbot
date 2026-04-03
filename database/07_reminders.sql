-- ============================================================
-- 07_reminders.sql
-- Nhắc lịch cho người dùng, gửi qua web/zalo/email.
-- APScheduler kiểm tra bảng này mỗi phút.
-- ============================================================

CREATE TABLE reminders (
    id         UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    task_id    UUID         REFERENCES tasks (id) ON DELETE SET NULL,
        -- Liên kết với task nếu nhắc về một task cụ thể
    title      VARCHAR(500) NOT NULL,
    message    TEXT,
        -- Nội dung chi tiết của reminder (có thể do AI soạn)
    remind_at  TIMESTAMPTZ  NOT NULL,
    channels   TEXT[]       NOT NULL DEFAULT '{web}',
        -- Giá trị hợp lệ trong mảng: web | zalo | email
    is_sent    BOOLEAN      NOT NULL DEFAULT FALSE,
    sent_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Partial index: chỉ index những reminder chưa gửi
-- APScheduler dùng index này để query hiệu quả
CREATE INDEX idx_reminders_pending ON reminders (remind_at)
    WHERE is_sent = FALSE;

CREATE INDEX idx_reminders_user ON reminders (user_id, remind_at DESC);
