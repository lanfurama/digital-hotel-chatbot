-- ============================================================
-- schema_all.sql
-- File tổng hợp: chạy tất cả migration theo đúng thứ tự.
-- Dùng khi setup môi trường mới từ đầu.
--
-- Cách chạy:
--   psql -U postgres -d hotelchat -f schema_all.sql
-- ============================================================

\echo '>>> [00] Cài extensions...'
\i 00_extensions.sql

\echo '>>> [01] Tạo bảng users...'
\i 01_users.sql

\echo '>>> [02] Tạo bảng clients...'
\i 02_clients.sql

\echo '>>> [03] Tạo bảng sessions...'
\i 03_sessions.sql

\echo '>>> [04] Tạo bảng messages...'
\i 04_messages.sql

\echo '>>> [05] Tạo bảng knowledge_docs + doc_chunks...'
\i 05_knowledge.sql

\echo '>>> [06] Tạo bảng projects + tasks...'
\i 06_projects_tasks.sql

\echo '>>> [07] Tạo bảng reminders...'
\i 07_reminders.sql

\echo '>>> [08] Tạo bảng audit_logs...'
\i 08_audit_logs.sql

\echo '>>> [09] Tạo bảng crawl_jobs...'
\i 09_crawl_jobs.sql

\echo '>>> [10] Insert seed data...'
\i 10_seed.sql

\echo '>>> Done. Schema đã sẵn sàng.'
