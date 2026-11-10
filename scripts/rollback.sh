#!/usr/bin/env bash
# ====================================================================
# Automated Application Rollback Procedure
# Safely reverts API service to a specified stable tag with zero downtime
# ====================================================================
set -euo pipefail

TARGET_TAG="${1:-}"

if [ -z "$TARGET_TAG" ]; then
    echo "Usage: ./scripts/rollback.sh <TARGET_IMAGE_TAG>"
    echo "Example: ./scripts/rollback.sh 1.0.0"
    exit 1
fi

echo "=========================================="
echo "Initiating Application Rollback"
echo "Target Tag: ecommerce-api:$TARGET_TAG"
echo "Timestamp:  $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "=========================================="

# 1. Update environment variable
export IMAGE_TAG="$TARGET_TAG"

# 2. Trigger zero-downtime rolling update via docker compose
echo "Step 1: Re-deploying API service with target tag..."
docker compose up -d --no-deps --build=false api

# 3. Wait for readiness probe
echo "Step 2: Probing health and readiness endpoints..."
MAX_ATTEMPTS=20
ATTEMPT=0
HEALTHY=false

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/ready || true)
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    echo "Waiting for service readiness (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS, status: $HTTP_CODE)..."
    sleep 3
    ATTEMPT=$((ATTEMPT + 1))
done

if [ "$HEALTHY" = true ]; then
    echo "=========================================="
    echo "Rollback successfully completed!"
    echo "Service is healthy and accepting traffic on tag: $TARGET_TAG"
    echo "=========================================="
else
    echo "CRITICAL: Service failed readiness check following rollback!"
    echo "Check logs: docker compose logs api"
    exit 1
fi
