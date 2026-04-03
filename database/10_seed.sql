-- ============================================================
-- 10_seed.sql
-- Dữ liệu khởi tạo ban đầu (chạy sau khi tạo xong schema).
-- Tạo tài khoản admin mặc định và project mẫu.
-- !! Đổi email trước khi chạy !!
-- ============================================================

-- Admin mặc định (đổi email thành email Google của bạn)
INSERT INTO users (name, email, role, department)
VALUES ('Admin', 'admin@yourdomain.com', 'admin', 'Digital')
ON CONFLICT (email) DO NOTHING;

-- Project mặc định
INSERT INTO projects (name, description, type, owner_id)
SELECT
    'Vận hành Digital',
    'Dự án vận hành chung của team Digital',
    'operations',
    id
FROM users
WHERE email = 'admin@yourdomain.com'
ON CONFLICT DO NOTHING;
