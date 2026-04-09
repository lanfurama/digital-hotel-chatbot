# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal AI-powered chatbot platform for hotel staff. Full-stack app with FastAPI backend, Next.js frontend, PostgreSQL+pgvector for storage/vector search, and Ollama for self-hosted embeddings. Supports multiple channels: Zalo OA, WhatsApp, Web Chat, Email, and embeddable widget.

## Commands

### Local Development
```bash
make dev              # Start ollama + backend (8000) + frontend (3000)
make dev-backend      # Backend only: uvicorn with --reload
make dev-frontend     # Frontend only: npm run dev
```

### Docker
```bash
make up               # docker compose up -d
make down             # docker compose down
make build            # Rebuild images (--no-cache)
make fresh            # Destroy volumes + rebuild (resets all data)
```

### Lint
```bash
make lint             # ruff check + ruff format --check on backend/app/
```
Ruff config: `backend/ruff.toml` — Python 3.12, line length 100, rules: E/F/W/I/UP.

### Test
```bash
make test             # pytest tests/ -v (test suite not yet implemented)
```

### Utilities
```bash
make shell-app        # Bash into backend container
make shell-db         # psql into DB container (postgres/hotelchat)
make seed             # Load test data from database/10_seed.sql
make ollama-pull      # Pull nomic-embed-text embedding model
make check-health     # GET /health/detailed
```

## Architecture

**Backend** (`backend/app/`): FastAPI async app (Python 3.12).
- `main.py` — App init, middleware stack, scheduler startup
- `api/v1/` — Route handlers (chat, knowledge, tasks, reminders, admin, widget, zalo, auth)
- `core/` — Config (Pydantic Settings from .env), database (SQLAlchemy async), security (JWT + RBAC), deps
- `models/` — SQLAlchemy ORM models
- `schemas/` — Pydantic request/response schemas
- `services/` — Business logic layer
- `middleware/` — Audit logging, rate limiting, security headers

**AI Service** (`backend/app/services/ai/`): Modular provider pattern.
- `__init__.py` — Public API: `stream_chat()`, `chat_once()`, `route_model()`, `build_system_prompt()`
- `providers/base.py` — `BaseProvider` interface
- `providers/anthropic.py` — Claude API (Haiku for simple queries, Sonnet for complex)
- `providers/ollama.py` — Ollama fallback provider
- `context.py` — Context window management
- `prompts.py` — System prompt building
- `router.py` — Model routing logic (fast vs smart)

**RAG Pipeline** (`backend/app/services/`):
- `embedding.py` — Ollama nomic-embed-text wrapper (768-dim vectors)
- `knowledge.py` — Vector search via pgvector cosine similarity on `doc_chunks` table
- Documents chunked into 512-token pieces with HNSW index

**Frontend** (`frontend/src/`): Next.js 14 with App Router, TypeScript, Tailwind CSS.
- `app/` — Pages: chat, admin, tasks, reminders, login
- `lib/api.ts` — Fetch wrapper with JWT auth
- `lib/sse.ts` — Server-Sent Events handler for streaming chat
- Path alias: `@/*` → `src/*`

**Database** (`database/`): Numbered SQL scripts (00-11) for schema init. PostgreSQL 16 + pgvector extension. No Alembic migrations — schema managed via raw SQL.

**Message Flow**: Request → JWT verify + rate limit → RAG search (embed query → pgvector similarity) → build system prompt with context + RAG chunks → route to Haiku/Sonnet → Claude API stream with tools → response guard (sensitive data scan) → SSE stream to client + persist to DB.

## Key Conventions

- All backend DB operations use async SQLAlchemy (`AsyncSession`)
- Auth: Google SSO + JWT (15min access tokens). RBAC via `@require_role()` decorator
- AI provider switchable via `AI_PROVIDER` env var (anthropic/ollama)
- Response guard scans output for sensitive data (CCCD, card numbers, passwords)
- Vietnamese is the primary language for UI text and documentation
- Docker services: `hotelchat_app` (backend), `hotelchat_db` (postgres), ollama, frontend, nginx
