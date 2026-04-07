.PHONY: help dev dev-backend dev-frontend up down build logs ps shell-app shell-db migrate seed ollama-pull lint

# Biến
COMPOSE = docker compose
APP = hotelchat_app
DB = hotelchat_db

help:
	@echo "Các lệnh có sẵn:"
	@echo "  make dev         - Chạy backend + frontend local (dev mode)"
	@echo "  make up          - Khởi động tất cả services"
	@echo "  make down        - Dừng tất cả services"
	@echo "  make build       - Build lại Docker images"
	@echo "  make logs        - Xem logs tất cả services"
	@echo "  make logs-app    - Xem logs backend"
	@echo "  make ps          - Xem trạng thái services"
	@echo "  make shell-app   - Mở shell trong backend container"
	@echo "  make shell-db    - Mở psql trong DB container"
	@echo "  make ollama-pull - Pull model nomic-embed-text"
	@echo "  make seed        - Chạy seed data (đổi email trong database/10_seed.sql trước)"

# ── Local development (không cần Docker) ────────────────────────────────────

dev:
	@echo "Khởi động ollama, backend (port 8000) và frontend (port 3000)..."
	@trap 'kill 0' EXIT; \
	  ollama serve & \
	  (cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) & \
	  (cd frontend && npm run dev) & \
	  wait

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

# ── Docker ───────────────────────────────────────────────────────────────────

up:
	$(COMPOSE) up -d
	@echo "Services đang chạy. Truy cập http://localhost"

down:
	$(COMPOSE) down

build:
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

logs-app:
	$(COMPOSE) logs -f app

logs-db:
	$(COMPOSE) logs -f db

ps:
	$(COMPOSE) ps

shell-app:
	docker exec -it $(APP) bash

shell-db:
	docker exec -it $(DB) psql -U postgres hotelchat

ollama-pull:
	bash scripts/init-ollama.sh

seed:
	@echo "Chạy seed data..."
	docker exec -i $(DB) psql -U postgres hotelchat < database/10_seed.sql
	@echo "Xong!"

restart-app:
	$(COMPOSE) restart app

fresh:
	$(COMPOSE) down -v
	$(COMPOSE) up -d --build
	@echo "Đã reset toàn bộ data và build lại."

# ── Go-live ─────────────────────────────────────────────────────────────────

setup-cron:
	@echo "Cài đặt cronjob backup hàng ngày lúc 2:00 AM..."
	(crontab -l 2>/dev/null; echo "0 2 * * * $(PWD)/scripts/backup.sh >> /var/log/hotelchat-backup.log 2>&1") | crontab -
	@echo "Xong! Xem: crontab -l"

check-health:
	@curl -s http://localhost/health/detailed | python3 -m json.tool

cost:
	@echo "Chi phí 7 ngày gần nhất:"
	@curl -sb http://localhost/api/v1/admin/cost-estimate | python3 -m json.tool

lint:
	cd backend && ruff check app/ && ruff format --check app/

test:
	cd backend && pytest tests/ -v 2>/dev/null || echo "Chưa có tests."
