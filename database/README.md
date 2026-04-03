# Database

## Cách chạy

### Option A — Chạy tất cả 1 lần (khuyến nghị)

```bash
psql -U postgres -d hotelchat -f schema_all.sql
```

Nếu database chưa tồn tại:

```bash
psql -U postgres -c "CREATE DATABASE hotelchat;"
psql -U postgres -d hotelchat -f schema_all.sql
```

### Option B — Chạy từng file thủ công (theo đúng thứ tự)

```bash
psql -U postgres -d hotelchat -f 00_extensions.sql
psql -U postgres -d hotelchat -f 01_users.sql
psql -U postgres -d hotelchat -f 02_clients.sql
psql -U postgres -d hotelchat -f 03_sessions.sql
psql -U postgres -d hotelchat -f 04_messages.sql
psql -U postgres -d hotelchat -f 05_knowledge.sql
psql -U postgres -d hotelchat -f 06_projects_tasks.sql
psql -U postgres -d hotelchat -f 07_reminders.sql
psql -U postgres -d hotelchat -f 08_audit_logs.sql
psql -U postgres -d hotelchat -f 09_crawl_jobs.sql
psql -U postgres -d hotelchat -f 10_seed.sql
```

> **Lưu ý:** `00_extensions.sql` cần quyền SUPERUSER. Nếu chạy trong Docker thì user `postgres` mặc định đã có quyền này.

---

## Các file

| File | Nội dung | Bảng tạo ra |
|---|---|---|
| `00_extensions.sql` | PostgreSQL extensions | — |
| `01_users.sql` | Người dùng nội bộ | `users` |
| `02_clients.sql` | Website dùng embed widget | `clients` |
| `03_sessions.sql` | Cuộc hội thoại | `sessions` |
| `04_messages.sql` | Lịch sử tin nhắn | `messages` |
| `05_knowledge.sql` | Tài liệu + vector embeddings | `knowledge_docs`, `doc_chunks` |
| `06_projects_tasks.sql` | Quản lý công việc | `projects`, `tasks` |
| `07_reminders.sql` | Nhắc lịch | `reminders` |
| `08_audit_logs.sql` | Audit log (append-only) | `audit_logs` |
| `09_crawl_jobs.sql` | Tiến trình crawl website | `crawl_jobs` |
| `10_seed.sql` | Dữ liệu khởi tạo | — |
| `schema_all.sql` | Tổng hợp chạy 1 lần | — |

---

## Thứ tự dependency

```
users
  └── clients (created_by → users)
        ├── sessions (user_id → users, client_id → clients)
        │     └── messages (session_id → sessions)
        ├── knowledge_docs (created_by → users, client_id → clients)
        │     └── doc_chunks (doc_id → knowledge_docs)
        └── crawl_jobs (client_id → clients)

users
  └── projects (owner_id → users)
        └── tasks (created_by, assigned_to → users, project_id → projects)
              └── reminders (user_id → users, task_id → tasks)

users
  └── audit_logs (user_id → users)
```

---

## Ghi chú kỹ thuật

### set_updated_at trigger
Hàm `set_updated_at()` được tạo ở `01_users.sql` và tái sử dụng cho các bảng sau (`sessions`, `knowledge_docs`, `projects`, `tasks`). Không cần khai báo lại.

### audit_logs là append-only
Hai trigger `trg_audit_no_update` và `trg_audit_no_delete` sẽ throw exception nếu có ai cố UPDATE hoặc DELETE dữ liệu trong bảng này.

### doc_chunks HNSW index
- `m = 16`: số cạnh mỗi node trong graph
- `ef_construction = 64`: độ chính xác khi build index
- Khi query dùng: `ORDER BY embedding <=> $1` (cosine distance)
- Chỉ dùng chunks có `score > 0.7` (cosine similarity = `1 - distance`)

### Embedding NULL
`doc_chunks.embedding` cho phép NULL — chunk được insert trước, embedding được cập nhật sau khi Ollama xử lý xong. Backend cần filter `WHERE embedding IS NOT NULL` khi search.

---

## Checklist trước khi chạy production

- [ ] Đổi email trong `10_seed.sql` thành email thật
- [ ] Đặt `POSTGRES_PASSWORD` mạnh trong `.env`
- [ ] Verify pgvector extension đã được cài trong Docker image (`pgvector/pgvector:pg16`)
- [ ] Chạy `\dt` sau migration để confirm đủ 11 bảng
- [ ] Test insert 1 user và query lại được

---

## Progress

- [x] `00_extensions.sql` — uuid-ossp, pgvector, pgcrypto
- [x] `01_users.sql` — bảng users + trigger updated_at
- [x] `02_clients.sql` — bảng clients (widget mode)
- [x] `03_sessions.sql` — bảng sessions + constraint identity check
- [x] `04_messages.sql` — bảng messages + constraint content check
- [x] `05_knowledge.sql` — knowledge_docs + doc_chunks + HNSW index
- [x] `06_projects_tasks.sql` — projects + tasks
- [x] `07_reminders.sql` — reminders + partial index
- [x] `08_audit_logs.sql` — audit_logs + append-only triggers
- [x] `09_crawl_jobs.sql` — crawl_jobs (widget mode)
- [x] `10_seed.sql` — admin user mặc định + project mẫu
- [x] `schema_all.sql` — file tổng hợp chạy 1 lần
