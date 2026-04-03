# Kế hoạch Sprint

## Tổng quan

| Hạng mục | Chi tiết |
|---|---|
| Tổng thời gian | 16 tuần (4 sprint × 4 tuần) |
| Team | 1–2 developer + AI Agent (Claude Code) |
| Mục tiêu chi phí | < $26/tháng (200 msg/ngày) |
| Stack chính | Python FastAPI + Next.js + PostgreSQL + Claude API |

---

## Sprint 1 — Nền tảng (Tuần 1–4)

**Mục tiêu:** Hệ thống chạy được, auth hoạt động, chat cơ bản với knowledge base.

### S1-01: Setup Infrastructure

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S1-01-1 | Cấu hình Hetzner CX32, SSH, firewall rules | P0 |
| S1-01-2 | Cài Docker + Docker Compose, setup volumes | P0 |
| S1-01-3 | Tạo `docker-compose.yml` (postgres, nginx, app, ollama, next) | P0 |
| S1-01-4 | Setup PostgreSQL 16 + pgvector + pgcrypto extension | P0 |
| S1-01-5 | Chạy schema migrations (11 bảng) | P0 |
| S1-01-6 | Cài Ollama + pull `nomic-embed-text` model | P0 |
| S1-01-7 | Setup Nginx reverse proxy + Let's Encrypt SSL | P0 |
| S1-01-8 | Tạo `.env.example` với tất cả biến môi trường | P1 |

### S1-02: Backend Auth

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S1-02-1 | Setup FastAPI project, cấu trúc thư mục, config | P0 |
| S1-02-2 | Tạo SQLAlchemy models cho 11 bảng | P0 |
| S1-02-3 | Implement Google SSO (Authlib) | P0 |
| S1-02-4 | JWT middleware: issue, validate, refresh token | P0 |
| S1-02-5 | RBAC decorator: `require_role(admin/manager/staff)` | P0 |
| S1-02-6 | `POST /auth/google` và `POST /auth/refresh` endpoints | P0 |
| S1-02-7 | Unit tests cho auth flow | P1 |

### S1-03: Knowledge Base Core

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S1-03-1 | Document processor: extract text từ PDF/DOCX/XLSX | P0 |
| S1-03-2 | Chunking function (512 token, 64 overlap) | P0 |
| S1-03-3 | Embedding service gọi Ollama `nomic-embed-text` | P0 |
| S1-03-4 | Batch insert `doc_chunks` với pgvector | P0 |
| S1-03-5 | `POST /knowledge/upload` endpoint | P0 |
| S1-03-6 | RAG search: cosine similarity query pgvector | P0 |
| S1-03-7 | `GET /knowledge/search` endpoint | P0 |
| S1-03-8 | `GET/PUT/DELETE /knowledge/docs` endpoints | P1 |

### S1-04: Chat Core

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S1-04-1 | AI Service: system prompt builder với RAG context | P0 |
| S1-04-2 | Anthropic SDK wrapper với streaming SSE (không dùng LangChain) | P0 |
| S1-04-3 | Model router: Haiku vs Sonnet theo intent | P0 |
| S1-04-4 | Session management: lưu/load `context_window` JSONB | P0 |
| S1-04-5 | `POST /chat/message` endpoint (SSE streaming) | P0 |
| S1-04-6 | `GET /chat/sessions` và `/sessions/{id}/messages` | P1 |
| S1-04-7 | Response Guard: filter sensitive data trong output | P0 |
| S1-04-8 | Audit log middleware cho tất cả requests | P0 |

### S1-05: Web Chat UI

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S1-05-1 | Setup Next.js 14 + TypeScript + Tailwind + shadcn/ui | P0 |
| S1-05-2 | Login page: Google SSO button | P0 |
| S1-05-3 | Chat UI: message list, input box, send button | P0 |
| S1-05-4 | SSE streaming render: token-by-token display | P0 |
| S1-05-5 | Tool call badge (hiện "Đang tra cứu...") | P1 |
| S1-05-6 | Session sidebar: danh sách cuộc trò chuyện | P1 |
| S1-05-7 | Mobile responsive | P1 |

---

## Sprint 2 — Tool Integration (Tuần 5–8)

**Mục tiêu:** AI có thể tạo task, set nhắc lịch, gọi Google Calendar, soạn email.

### S2-01: Task & Reminder System

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S2-01-1 | CRUD endpoints cho tasks và projects | P0 |
| S2-01-2 | CRUD endpoints cho reminders | P0 |
| S2-01-3 | APScheduler: job kiểm tra reminder mỗi phút | P0 |
| S2-01-4 | Gửi reminder qua Web notification (SSE) | P0 |
| S2-01-5 | Tool definitions: `create_task`, `set_reminder` cho Claude | P0 |
| S2-01-6 | Task board UI (kanban 4 cột) | P1 |

### S2-02: Google Integration

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S2-02-1 | Google OAuth scopes: calendar, gmail | P0 |
| S2-02-2 | Tool: `read_calendar` — xem lịch hôm nay/tuần này | P0 |
| S2-02-3 | Tool: `send_email` — soạn và gửi email qua Gmail | P0 |
| S2-02-4 | Tool: `create_spreadsheet` — tạo báo cáo Google Sheets | P1 |

### S2-03: Admin Panel

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S2-03-1 | Admin dashboard: stats (messages, tokens, users) | P0 |
| S2-03-2 | Knowledge base management UI (upload, list, delete) | P0 |
| S2-03-3 | User management UI (list, change role) | P0 |
| S2-03-4 | Audit log viewer | P1 |

---

## Sprint 3 — Multi-channel + Widget (Tuần 9–12)

**Mục tiêu:** Tích hợp Zalo OA, xây dựng embed widget.

### S3-01: Zalo OA Integration

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S3-01-1 | Đăng ký Zalo OA, lấy credentials | P0 |
| S3-01-2 | Webhook handler + HMAC-SHA256 verify | P0 |
| S3-01-3 | Parse Zalo message events → AIService | P0 |
| S3-01-4 | Gửi response về Zalo OA API | P0 |
| S3-01-5 | Gửi reminder qua Zalo (APScheduler) | P1 |

### S3-02: Embed Widget

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S3-02-1 | Widget JS: floating button, chat window, SSE streaming | P0 |
| S3-02-2 | Bundle widget với esbuild → `widget.js` | P0 |
| S3-02-3 | `POST /widget/message` endpoint (dùng `client_api_key`) | P0 |
| S3-02-4 | Client management: tạo client, sinh `api_key` | P0 |
| S3-02-5 | Validate `Origin` header khớp với `client.domain` | P0 |
| S3-02-6 | Crawler service: crawl URL → extract text → chunk → embed | P0 |
| S3-02-7 | `POST /widget/clients/{id}/crawl` endpoint + progress tracking | P1 |
| S3-02-8 | Admin UI: quản lý clients + trigger crawl | P1 |

---

## Sprint 4 — Tối ưu & Go-live (Tuần 13–16)

**Mục tiêu:** Tối ưu hiệu năng, hoàn thiện bảo mật, triển khai production.

### S4-01: Performance

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S4-01-1 | Cache embedding kết quả cho query trùng lặp (Redis nhỏ hoặc in-memory LRU) | P1 |
| S4-01-2 | Tối ưu HNSW index parameters theo data thực tế | P1 |
| S4-01-3 | Context window summarization (Haiku) khi session quá dài | P0 |
| S4-01-4 | Connection pool tuning cho PostgreSQL | P1 |

### S4-02: Security hardening

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S4-02-1 | Prompt injection test: thử tấn công từ Zalo/Widget | P0 |
| S4-02-2 | Rate limiting kiểm tra hoạt động đúng | P0 |
| S4-02-3 | Response Guard: bổ sung thêm sensitive patterns | P0 |
| S4-02-4 | Security review toàn bộ API endpoints | P0 |

### S4-03: CI/CD & Monitoring

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S4-03-1 | GitHub Actions: lint + test + build Docker image | P0 |
| S4-03-2 | Auto-deploy lên VPS khi merge vào `main` | P0 |
| S4-03-3 | Health check endpoint + auto-rollback | P0 |
| S4-03-4 | Structured JSON logging (ghi file, rotate daily) | P0 |
| S4-03-5 | Backup script: pg_dump → Cloudflare R2 | P0 |

### S4-04: Go-live

| Task | Mô tả | Ưu tiên |
|---|---|---|
| S4-04-1 | Upload toàn bộ tài liệu nội bộ vào knowledge base | P0 |
| S4-04-2 | Onboarding team: hướng dẫn sử dụng | P0 |
| S4-04-3 | Monitor chi phí Claude API tuần đầu | P0 |
| S4-04-4 | Thu thập feedback, lên kế hoạch iteration | P1 |

---

## Thứ tự ưu tiên tuyệt đối

Để có MVP sớm nhất, focus theo thứ tự:

```
1. DB schema + migrations
2. Google SSO + JWT
3. RAG pipeline (upload → embed → search)
4. Chat endpoint với streaming
5. Web UI cơ bản
→ MVP nội bộ chạy được sau ~3 tuần
```
