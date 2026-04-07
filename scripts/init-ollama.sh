#!/bin/bash
# Pull nomic-embed-text model vào Ollama sau khi container đã chạy

set -e

OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
MODEL="nomic-embed-text"

echo "Chờ Ollama khởi động..."
for i in $(seq 1 30); do
    if curl -sf "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
        echo "Ollama đã sẵn sàng."
        break
    fi
    echo "  Thử lần $i/30..."
    sleep 3
done

echo "Pulling model ${MODEL}..."
curl -X POST "${OLLAMA_URL}/api/pull" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${MODEL}\"}" \
    --no-buffer

echo ""
echo "Hoàn thành! Model ${MODEL} đã sẵn sàng."
