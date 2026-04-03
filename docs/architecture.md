# Kiến trúc Hệ thống

## 1. Tổng quan

Hotel Digital Team Chatbot là nền tảng AI nội bộ thiết kế theo kiến trúc **monolithic-modular** để tối ưu chi phí vận hành dưới $26/tháng. Hệ thống hỗ trợ hai chế độ hoạt động:

- **Internal mode**: Chatbot cho nhân viên nội bộ — tra cứu tài liệu, quản lý công việc
- **Widget mode**: Embed chatbot lên website bên ngoài, tự học nội dung website đó

---

## 2. Kiến trúc 7 tầng

```
[Zalo OA / WhatsApp / Web Chat / Email / Embed Widget]
                        │
        ┌───────────────▼───────────────┐
        │  L1  Channel Gateway          │  Nginx + Webhook handler
        │      Nhận message từ mọi kênh │
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  L2  Security Layer           │  FastAPI middleware
        │      JWT · RBAC · Rate limit  │  Google SSO
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  L3  AI Orchestrator          │  Anthropic SDK (direct)
        │      Intent · Context · Route │  Haiku vs Sonnet router
        └──────┬────────────────┬───────┘
               │                │
   ┌───────────▼──┐    ┌────────▼────────┐
   │  L4  RAG     │    │  L5  Tools      │
   │  pgvector +  │    │  Calendar       │
   │  Ollama      │    │  Gmail · Sheets │
   │  embed       │    │  Tasks · Remind │
   └───────────┬──┘    └────────┬────────┘
               │                │
        ┌──────▼────────────────▼───────┐
        │  L6  Storage                  │  PostgreSQL 16 + pgvector
        │      Chat · Docs · Tasks · Log│
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │  L7  Admin UI                 │  Next.js 14
        │      Docs · Users · Stats     │
        └───────────────────────────────┘
```

---

## 3. Luồng xử lý tin nhắn

```
User gửi message
      │
      ▼
[1] Verify auth (JWT) + rate limit
      │
      ▼
[2] RAG Search
    Embed query (Ollama) → cosine similarity trong pgvector
    Lấy top-5 chunks liên quan (score > 0.7)
      │
      ▼
[3] Build system prompt
    System context + RAG chunks + user role + conversation history
      │
      ▼
[4] Model routing
    ├─ Haiku  → câu hỏi đơn giản, tra cứu thông tin
    └─ Sonnet → lập kế hoạch, phân tích, tạo báo cáo
      │
      ▼
[5] Claude API stream
    Nếu cần tool → gọi tool (Calendar, Gmail, Tasks...)
    Kết quả tool → đưa lại vào context → tiếp tục generate
      │
      ▼
[6] Response Guard
    Scan output: phát hiện CCCD, số thẻ, mật khẩu → block nếu có
      │
      ▼
[7] Stream SSE về client (token by token)
    Lưu message vào DB + audit log
```

---

## 4. Tech Stack chi tiết

### 4.1 Backend

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| API Server | Python 3.12 + FastAPI | Async native, streaming SSE, typing tốt |
| LLM | Anthropic SDK (trực tiếp) | Không dùng LangChain — ít dependency, dễ debug |
| Embedding | Ollama + nomic-embed-text | Self-hosted, free, hỗ trợ tiếng Việt tốt |
| Task scheduler | APScheduler (in-process) | Đủ cho reminder + periodic jobs, không cần Redis |
| Auth | python-jose + Authlib | JWT ngắn hạn + Google SSO |
| Migrations | Alembic | Version control cho schema |

> **Lý do không dùng LangChain:** RAG pipeline và tool calling có thể tự viết ~50 dòng code. LangChain thêm complexity, khó debug, hay có breaking changes.

> **Lý do không dùng Celery:** APScheduler nhúng trong FastAPI đủ xử lý reminder và email định kỳ cho quy mô này. Thêm Celery sau nếu cần heavy background jobs.

### 4.2 Frontend

| Thành phần | Công nghệ | Lý do |
|---|---|---|
| Web App | Next.js 14 + TypeScript | Component-based, streaming render dễ |
| Styling | Tailwind CSS + shadcn/ui | Component có sẵn, không cần design từ đầu |
| Chat Streaming | Server-Sent Events (SSE) | Nhẹ hơn WebSocket, đủ dùng cho chat |
| Widget | Vanilla JS bundle | Nhúng được vào bất kỳ website nào |

### 4.3 Infrastructure

| Thành phần | Dịch vụ | Chi phí |
|---|---|---|
| VPS | Hetzner CX32 (4vCPU, 8GB RAM, 80GB SSD) | $8.5/tháng |
| Database | PostgreSQL 16 self-hosted trên VPS | $0 |
| File Storage | Cloudflare R2 (10GB free) | $0 |
| CDN + SSL | Cloudflare Free + Let's Encrypt | $0 |
| Backup | Hetzner daily snapshot | $2/tháng |
| LLM | Claude API (Haiku ~$0.25/M tokens) | $9–15/tháng |

> **Lý do chọn CX32 (8GB)** thay vì CX22 (4GB): Ollama + nomic-embed-text cần ~1.2GB RAM. Cộng với PostgreSQL, FastAPI, Next.js, Nginx thì CX22 sát giới hạn, dễ OOM.

> **Monitoring:** Không dùng Grafana/Prometheus ở giai đoạn đầu. Dùng structured JSON logging + bảng `system_stats` trong DB. Thêm Grafana khi cần thiết.

---

## 5. Embed Widget

### 5.1 Cách hoạt động

Website bên ngoài nhúng một dòng script:

```html
<script
  src="https://chat.hotel-internal.com/widget.js"
  data-key="CLIENT_API_KEY"
  data-color="#534AB7"
></script>
```

Widget JS tự tạo chat bubble ở góc màn hình. Mọi tin nhắn đều gọi về backend qua `client_api_key` để xác định ngữ cảnh.

### 5.2 Học nội dung website

```
Admin nhập URL website
        │
        ▼
Crawler service crawl các trang
        │
        ▼
Extract text (readability + html parser)
        │
        ▼
Chunk 512 tokens → embed (Ollama) → lưu doc_chunks
với metadata: client_id, source_url, page_title
        │
        ▼
RAG tự động filter theo client_id khi chat
```

### 5.3 Database mở rộng cho multi-tenant

Thêm 2 bảng:
- `clients` — mỗi website là 1 client (api_key, domain, settings)
- `crawl_jobs` — theo dõi tiến trình crawl

Chi tiết trong [database.md](database.md).

---

## 6. Bảo mật

### 6.1 Authentication & Authorization

- Google SSO là identity provider chính cho nhân viên nội bộ
- JWT token 15 phút + refresh token 7 ngày, lưu HttpOnly cookie
- RBAC 3 cấp: `admin > manager > staff`
- Widget dùng `client_api_key` riêng (không liên quan JWT nội bộ)

### 6.2 Data Security

- TLS 1.3 bắt buộc cho mọi kết nối
- AES-256 mã hoá dữ liệu at rest (PostgreSQL pgcrypto)
- Response Guard: scan output trước khi stream — phát hiện CCCD, số thẻ, mật khẩu
- Webhook Zalo/WhatsApp: verify HMAC-SHA256 signature trước khi xử lý
- Prompt injection prevention: sanitize input từ external channels

### 6.3 Audit

- 100% request đều log: `user_id, action, resource, ip, timestamp, response_code`
- Bảng `audit_logs` là append-only (không UPDATE/DELETE)
- Retention 1 năm

---

## 7. Deployment

### 7.1 Docker Compose services

```yaml
services:
  app:      # FastAPI backend
  db:       # PostgreSQL 16 + pgvector
  ollama:   # nomic-embed-text embedding
  nginx:    # Reverse proxy + SSL termination
  next:     # Next.js frontend
```

5 services (không có Redis/Celery worker).

### 7.2 CI/CD

```
git push → GitHub Actions (lint + test)
         → Build Docker image
         → SSH vào VPS
         → docker compose pull && docker compose up -d
         → Health check → rollback nếu thất bại
```

### 7.3 Environment Variables

```bash
# LLM
ANTHROPIC_API_KEY=

# Google OAuth + APIs
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=
JWT_ALGORITHM=HS256

# Zalo / WhatsApp
ZALO_OA_SECRET=
WHATSAPP_VERIFY_TOKEN=

# Storage
CLOUDFLARE_R2_ACCESS_KEY=
CLOUDFLARE_R2_SECRET_KEY=
CLOUDFLARE_R2_BUCKET=
```
