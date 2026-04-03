-- ============================================================
-- 06_projects_tasks.sql
-- projects: nhóm các task theo dự án
-- tasks:    công việc cụ thể, gán cho từng người
-- ============================================================

-- ------------------------------------------------------------
-- Dự án
-- ------------------------------------------------------------
CREATE TABLE projects (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(300) NOT NULL,
    description TEXT,
    type        VARCHAR(100),
        -- marketing | sales | operations | event | other
    status      VARCHAR(50)  NOT NULL DEFAULT 'active',
        -- active | on_hold | completed | cancelled
    start_date  DATE,
    end_date    DATE,
    owner_id    UUID         REFERENCES users (id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT projects_status_check CHECK (
        status IN ('active', 'on_hold', 'completed', 'cancelled')
    )
);

CREATE INDEX idx_projects_owner  ON projects (owner_id);
CREATE INDEX idx_projects_status ON projects (status);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
-- Công việc
-- ------------------------------------------------------------
CREATE TABLE tasks (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(500) NOT NULL,
    description TEXT,
    status      VARCHAR(50)  NOT NULL DEFAULT 'todo',
        -- todo | in_progress | review | done | cancelled
    priority    VARCHAR(20)  NOT NULL DEFAULT 'medium',
        -- low | medium | high | urgent
    due_date    DATE,
    project_id  UUID         REFERENCES projects (id) ON DELETE SET NULL,
    created_by  UUID         REFERENCES users (id) ON DELETE SET NULL,
    assigned_to UUID         REFERENCES users (id) ON DELETE SET NULL,
    tags        TEXT[]       NOT NULL DEFAULT '{}',
    metadata    JSONB        NOT NULL DEFAULT '{}',
        -- Thông tin thêm do AI điền, ví dụ: {"source_session": "uuid"}
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT tasks_status_check CHECK (
        status IN ('todo', 'in_progress', 'review', 'done', 'cancelled')
    ),
    CONSTRAINT tasks_priority_check CHECK (
        priority IN ('low', 'medium', 'high', 'urgent')
    )
);

CREATE INDEX idx_tasks_assigned   ON tasks (assigned_to, status);
CREATE INDEX idx_tasks_project    ON tasks (project_id);
CREATE INDEX idx_tasks_due        ON tasks (due_date) WHERE status NOT IN ('done', 'cancelled');
CREATE INDEX idx_tasks_created_by ON tasks (created_by);

CREATE TRIGGER trg_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
