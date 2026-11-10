#!/usr/bin/env bash
# ====================================================================
# Automated Database Backup Script (PostgreSQL)
# Produces timestamped, compressed SQL backups with SHA256 checksums
# ====================================================================
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/ecommerce_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="ecommerce-db"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-ecommerce_db}"

echo "=========================================="
echo "Starting PostgreSQL Database Backup"
echo "Target Container: $CONTAINER_NAME"
echo "Target Database:  $DB_NAME"
echo "Destination:      $BACKUP_FILE"
echo "Timestamp:        $TIMESTAMP"
echo "=========================================="

# Check if Docker container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '${CONTAINER_NAME}' is not running!"
    exit 1
fi

# Execute pg_dump and pipe through gzip
docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" --clean --if-exists "$DB_NAME" | gzip > "$BACKUP_FILE"

# Calculate checksum
CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')
FILESIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')

echo "Backup completed successfully!"
echo "File size: $FILESIZE"
echo "SHA256:    $CHECKSUM"
echo "$CHECKSUM  $(basename "$BACKUP_FILE")" > "${BACKUP_FILE}.sha256"
echo "=========================================="
