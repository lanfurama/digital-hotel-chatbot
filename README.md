# Hotel Digital Team Chatbot

Nền tảng AI nội bộ cho team Digital khách sạn — tích hợp kho kiến thức, trợ lý công việc, quản lý task và kênh giao tiếp đa nền tảng.

## Tính năng chính

- **Knowledge Base** — tra cứu chính sách, gói phòng, quy định nội bộ bằng ngôn ngữ tự nhiên
- **Work Assistant** — tạo task, nhắc lịch, soạn email, tạo báo cáo Excel
- **Multi-channel** — Zalo OA, WhatsApp Business, Web Chat, Email
- **Embed Widget** — nhúng chatbot lên bất kỳ website nào, tự học nội dung website đó
- **Admin Panel** — quản lý tài liệu, người dùng, xem thống kê và audit log

## Tech Stack

| Tầng | Công nghệ |
|---|---|
| Backend API | Python 3.12 + FastAPI |
| LLM | Claude API (Haiku + Sonnet) via Anthropic SDK |
| Embedding | Ollama + nomic-embed-text (self-hosted) |
| Vector Search | PostgreSQL 16 + pgvector |
| Task Queue | APScheduler (nhúng trong FastAPI) |
| Auth | Google SSO + JWT (python-jose + Authlib) |
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Streaming | Server-Sent Events (SSE) |
| File Storage | Cloudflare R2 |
| Infrastructure | Docker Compose trên Hetzner CX32 (8GB RAM) |

## Khởi động nhanh

**Yêu cầu:** Python 3.12 (virtualenv đã activate), Node.js 18+, PostgreSQL 16 + pgvector, Ollama đã cài.

```bash
# Chạy cả backend lẫn frontend cùng lúc
make dev

# Hoặc riêng lẻ
make dev-backend   # Backend → http://localhost:8000
make dev-frontend  # Frontend → http://localhost:3000
```

Ctrl+C để dừng cả hai.

## Tài liệu

- [Kiến trúc hệ thống](docs/architecture.md)
- [Thiết kế Database](docs/database.md)
- [Đặc tả API](docs/api.md)
- [Hướng dẫn lập trình](docs/dev-guide.md)
- [Kế hoạch Sprint](docs/sprint-plan.md)

## Cấu trúc thư mục

```
hotel-chatbot/
├── backend/
│   ├── app/
│   │   ├── api/          # Route handlers
│   │   ├── core/         # Config, database, security
│   │   ├── services/     # Business logic
│   │   ├── models/       # SQLAlchemy models
│   │   └── schemas/      # Pydantic schemas
│   ├── migrations/       # Alembic migrations
│   └── tests/
├── frontend/
│   ├── app/
│   │   ├── chat/         # Chat UI
│   │   └── admin/        # Admin panel
│   └── components/
├── widget/               # Embed widget JS
├── docs/                 # Tài liệu kỹ thuật
├── docker-compose.yml
└── .env.example
```

## Chi phí vận hành

| Dịch vụ | Chi phí/tháng |
|---|---|
| Hetzner CX32 (8GB RAM, 4vCPU) | $8.5 |
| Cloudflare R2 (10GB free) | $0 |
| Cloudflare CDN + SSL | $0 |
| Hetzner daily snapshot | $2 |
| Claude API (~200 msg/ngày) | $9–15 |
| **Tổng** | **~$20–26/tháng** |
