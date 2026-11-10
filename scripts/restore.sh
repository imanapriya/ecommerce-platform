#!/usr/bin/env bash
# ====================================================================
# Automated Database Restore Script (PostgreSQL)
# Restores a compressed SQL dump and verifies post-restore integrity
# ====================================================================
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
CONTAINER_NAME="ecommerce-db"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-ecommerce_db}"

# Determine backup file: argument or latest
if [ $# -ge 1 ]; then
    TARGET_BACKUP="$1"
else
    TARGET_BACKUP=$(ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | head -n 1 || true)
fi

if [ -z "$TARGET_BACKUP" ] || [ ! -f "$TARGET_BACKUP" ]; then
    echo "ERROR: No valid backup file found in $BACKUP_DIR"
    exit 1
fi

echo "=========================================="
echo "Starting PostgreSQL Database Restoration"
echo "Backup File:      $TARGET_BACKUP"
echo "Target Container: $CONTAINER_NAME"
echo "Target Database:  $DB_NAME"
echo "=========================================="

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Restore database
if [[ "$TARGET_BACKUP" == *.gz ]]; then
    gzip -dc "$TARGET_BACKUP" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null
else
    docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" < "$TARGET_BACKUP" > /dev/null
fi

echo "Database restored successfully!"
echo "Verifying restored entity counts:"
docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 'products' as table, count(*) FROM products UNION ALL SELECT 'orders', count(*) FROM orders;"
echo "=========================================="
