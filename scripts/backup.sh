#!/bin/bash
# Backup PostgreSQL → Cloudflare R2
# Chạy hàng ngày lúc 2:00 AM qua cron: 0 2 * * * /opt/hotel-chatbot/scripts/backup.sh

set -euo pipefail

# Load env
source /opt/hotel-chatbot/.env 2>/dev/null || true

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="/tmp/hotelchat_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=7

echo "[$(date)] Starting backup..."

# pg_dump → gzip
docker exec hotelchat_db pg_dump \
    -U "${DB_USER:-postgres}" \
    "${DB_NAME:-hotelchat}" \
    | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Dump created: $BACKUP_FILE ($BACKUP_SIZE)"

# Upload lên Cloudflare R2 dùng AWS CLI (compatible với R2)
if command -v aws &>/dev/null && [ -n "${CLOUDFLARE_R2_ACCESS_KEY:-}" ]; then
    aws s3 cp "$BACKUP_FILE" \
        "s3://${CLOUDFLARE_R2_BUCKET:-hotel-chatbot}/backups/$(basename "$BACKUP_FILE")" \
        --endpoint-url "${CLOUDFLARE_R2_ENDPOINT}" \
        --no-progress \
        2>&1

    # Xoá backup cũ hơn RETENTION_DAYS ngày
    CUTOFF=$(date -d "${RETENTION_DAYS} days ago" +%Y%m%d 2>/dev/null || \
             date -v-${RETENTION_DAYS}d +%Y%m%d 2>/dev/null || echo "0")
    aws s3 ls "s3://${CLOUDFLARE_R2_BUCKET:-hotel-chatbot}/backups/" \
        --endpoint-url "${CLOUDFLARE_R2_ENDPOINT}" \
        | awk '{print $4}' \
        | grep "^hotelchat_" \
        | while read -r fname; do
            fdate=$(echo "$fname" | grep -oP '\d{8}' | head -1 || true)
            if [ -n "$fdate" ] && [ "$fdate" -lt "$CUTOFF" ]; then
                aws s3 rm "s3://${CLOUDFLARE_R2_BUCKET:-hotel-chatbot}/backups/$fname" \
                    --endpoint-url "${CLOUDFLARE_R2_ENDPOINT}"
                echo "[$(date)] Deleted old backup: $fname"
            fi
        done

    echo "[$(date)] Upload to R2 complete"
else
    echo "[$(date)] WARNING: AWS CLI not found or R2 credentials missing. Backup kept locally only."
fi

# Xoá file tạm
rm -f "$BACKUP_FILE"
echo "[$(date)] Backup done."
