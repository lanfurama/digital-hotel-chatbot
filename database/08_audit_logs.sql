-- ============================================================
-- 08_audit_logs.sql
-- Log toàn bộ hành động trong hệ thống.
-- Bảng này là APPEND-ONLY: không bao giờ UPDATE hoặc DELETE.
-- Retention policy: 1 năm.
-- ============================================================

CREATE TABLE audit_logs (
    id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID         REFERENCES users (id) ON DELETE SET NULL,
        -- NULL nếu là anonymous widget visitor hoặc system action
    action        VARCHAR(100) NOT NULL,
        -- login | logout | chat_message | doc_upload | doc_delete
        -- task_create | task_update | reminder_set | admin_action
        -- widget_message | crawl_start | crawl_done
    resource_type VARCHAR(100),
        -- users | sessions | messages | knowledge_docs | tasks | reminders
    resource_id   UUID,
        -- ID của resource bị tác động
    metadata      JSONB        NOT NULL DEFAULT '{}',
        -- Thông tin thêm tuỳ theo action, ví dụ:
        -- {model_used, tokens_used, query_text, doc_title, ...}
    ip_address    INET,
    user_agent    TEXT,
    response_code INTEGER,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user      ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_action    ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_resource  ON audit_logs (resource_type, resource_id);
CREATE INDEX idx_audit_created   ON audit_logs (created_at DESC);

-- Ngăn UPDATE và DELETE trên bảng audit_logs
CREATE OR REPLACE FUNCTION deny_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs là append-only, không được phép % dữ liệu', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();

CREATE TRIGGER trg_audit_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION deny_audit_mutation();
