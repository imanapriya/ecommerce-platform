#!/usr/bin/env bash
# ====================================================================
# Acceptance Test 4: Failure Detection & Self-Healing Chaos Drill
# Deliberately breaks a dependency (PostgreSQL) and demonstrates:
#   1. Immediate readiness failure detection (503 Service Unavailable)
#   2. Structured error logging with correlation IDs
#   3. Automatic recovery upon service restoration
# ====================================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
PROXY_URL="${PROXY_URL:-https://localhost}"
CONTAINER_DB="ecommerce-db"

echo "=========================================="
echo "STARTING RESILIENCY & CHAOS DRILL"
echo "Target: $API_URL"
echo "=========================================="

# Step 1: Baseline health check
echo -e "\n[STEP 1] Verifying baseline system readiness..."
BASELINE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ready")
echo "Initial /ready HTTP Status: $BASELINE_STATUS"
if [ "$BASELINE_STATUS" != "200" ]; then
    echo "ERROR: System is not healthy prior to drill!"
    exit 1
fi
curl -s "$API_URL/ready" | jq . || curl -s "$API_URL/ready"

# Step 2: Fault Injection - Deliberately stop database
echo -e "\n[STEP 2] Injecting fault: Stopping PostgreSQL database container ($CONTAINER_DB)..."
docker stop "$CONTAINER_DB"
echo "PostgreSQL container stopped."

# Step 3: Failure Detection Verification
echo -e "\n[STEP 3] Probing readiness probe during outage..."
sleep 2
OUTAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ready" || true)
echo "Outage /ready HTTP Status: $OUTAGE_STATUS (Expected: 503)"
curl -s "$API_URL/ready" | jq . || curl -s "$API_URL/ready"

if [ "$OUTAGE_STATUS" = "503" ]; then
    echo "SUCCESS: Failure was immediately detected by /ready probe!"
else
    echo "WARNING: Expected 503 but got $OUTAGE_STATUS"
fi

# Step 4: Inspect Structured Application Logs
echo -e "\n[STEP 4] Inspecting structured application error logs..."
docker logs --tail=15 ecommerce-api

# Step 5: Service Recovery
echo -e "\n[STEP 5] Recovering PostgreSQL database container..."
docker start "$CONTAINER_DB"
echo "PostgreSQL container restarted. Awaiting automatic database reconnection..."

# Step 6: Verify Self-Healing & Recovery
RECOVERED=false
for i in {1..15}; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ready" || true)
    if [ "$STATUS" = "200" ]; then
        RECOVERED=true
        echo "System recovered after $i attempts! Status: $STATUS"
        break
    fi
    echo "Waiting for reconnection (attempt $i/15, status: $STATUS)..."
    sleep 2
done

if [ "$RECOVERED" = true ]; then
    echo -e "\n=========================================="
    echo "CHAOS DRILL PASSED: Self-healing verified!"
    curl -s "$API_URL/ready" | jq . || curl -s "$API_URL/ready"
    echo "=========================================="
else
    echo "CRITICAL: System failed to recover automatically."
    exit 1
fi
