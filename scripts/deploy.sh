#!/bin/bash
# Manual deploy script — dùng khi cần deploy tay
# Chạy trên VPS: bash scripts/deploy.sh

set -euo pipefail

APP_DIR="/opt/hotel-chatbot"
HEALTH_URL="http://localhost/health"

echo "=== Hotel Chatbot Deploy ==="
echo "Time: $(date)"
echo "Dir: $APP_DIR"

cd "$APP_DIR"

echo ""
echo "--- Pulling latest code ---"
git fetch origin main
PREV_COMMIT=$(git rev-parse HEAD)
git reset --hard origin/main
NEW_COMMIT=$(git rev-parse HEAD)
echo "  $PREV_COMMIT → $NEW_COMMIT"

echo ""
echo "--- Building Docker images ---"
docker compose build --no-cache app next

echo ""
echo "--- Starting services ---"
docker compose up -d --remove-orphans

echo ""
echo "--- Health check (30s timeout) ---"
for i in $(seq 1 10); do
    sleep 3
    STATUS=$(curl -sf "$HEALTH_URL" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','fail'))" 2>/dev/null || echo "fail")
    echo "  Attempt $i: $STATUS"
    if [ "$STATUS" = "ok" ]; then
        echo ""
        echo "Deploy SUCCEEDED!"
        docker image prune -f
        exit 0
    fi
done

echo ""
echo "ERROR: Health check failed — rolling back to $PREV_COMMIT"
git reset --hard "$PREV_COMMIT"
docker compose up -d --remove-orphans
exit 1
