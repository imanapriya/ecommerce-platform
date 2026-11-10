# Operations & Incident Response Runbook
**System:** Cloud Deployment & CI/CD – E-Commerce Platform API  
**Audience:** SREs, DevOps Engineers, and System Operators

---

## 1. Quick Reference & Port Map

| Component | Container Name | Internal Port | External Port | Protocol | Access Policy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nginx Reverse Proxy** | `ecommerce-proxy` | 80, 443 | 80, 443 | HTTP, HTTPS | Public / Ingress |
| **E-Commerce API** | `ecommerce-api` | 3000 | 127.0.0.1:3000 | HTTP | Internal / Loopback Only |
| **PostgreSQL Database** | `ecommerce-db` | 5432 | 127.0.0.1:5432 | TCP | Internal / Loopback Only |

---

## 2. Deployment Procedures

### 2.1 Clean Initial Deployment
```bash
# 1. Clone the repository
git clone https://github.com/imanapriya/ecommerce-platform.git
cd ecommerce-platform

# 2. Configure environment
cp .env.example .env

# 3. Ensure TLS certificates exist (already generated, or regenerate via script)
./scripts/generate-ssl.sh    # or: pwsh ./scripts/generate-ssl.ps1

# 4. Build and start services in detached mode
docker compose up -d --build

# 5. Verify service health
docker compose ps
curl -k https://localhost/healthz
curl -k https://localhost/ready
```

### 2.2 Zero-Downtime Rolling Update
To update the API without dropping client requests:
```bash
# 1. Build new image version
docker build -t ecommerce-api:1.0.1 .

# 2. Update IMAGE_TAG in .env or shell environment
export IMAGE_TAG=1.0.1

# 3. Trigger rolling restart of api container
docker compose up -d --no-deps api

# 4. Verify readiness
curl -k https://localhost/ready
```

---

## 3. Observability & Log Inspection

### 3.1 Probing Health & Readiness
- **Liveness Probe:** `curl -s https://localhost/healthz`
  - Expected: HTTP 200 `{"status":"healthy","uptimeSeconds":...}`
- **Readiness Probe:** `curl -s https://localhost/ready`
  - Expected: HTTP 200 `{"status":"ready","ready":true,"checks":{"database":{"status":"healthy"}}}`
- **Prometheus Metrics:** `curl -s https://localhost/metrics`
  - Returns request counters, latency histograms, and order metrics.

### 3.2 Structured Log Tracing
Application logs are formatted in JSON and include correlation IDs (`X-Request-Id`):
```bash
# Follow live API logs
docker compose logs -f api

# Filter logs for errors only
docker compose logs api | grep '"level":"error"'

# Trace specific request by correlation ID
docker compose logs api | grep '"correlationId":"<REQ_UUID>"'

# View Nginx access logs with upstream latency
docker compose logs -f proxy
```

---

## 4. Disaster Recovery & Rollback Procedures

### 4.1 Database Backup
Create an immediate snapshot before executing schema changes or releases:
```bash
# Linux / macOS
./scripts/backup.sh

# Windows PowerShell
.\scripts\backup.ps1
```
Backups are saved to `backups/ecommerce_backup_<TIMESTAMP>.sql.gz` along with a SHA256 checksum file.

### 4.2 Database Restoration
To restore the latest backup or a specific point-in-time snapshot:
```bash
# Linux / macOS (restores latest automatically)
./scripts/restore.sh

# Or restore specific dump:
./scripts/restore.sh backups/ecommerce_backup_20261110_103000.sql.gz

# Windows PowerShell
.\scripts\restore.ps1 -BackupFile "backups\ecommerce_backup_20261110_103000.sql"
```

### 4.3 Application Rollback
If a newly deployed image exhibits critical regressions:
```bash
# Linux / macOS
./scripts/rollback.sh 1.0.0

# Windows PowerShell
.\scripts\rollback.ps1 -TargetTag "1.0.0"
```
The script will redeploy the specified stable container image and poll the readiness probe until traffic is safely routed.

---

## 5. Incident Response Playbooks

### Playbook 1: Database Outage (`/ready` returns 503)
1. **Symptom:** Clients receive 503 or gateway errors; `/ready` reports `ready: false`.
2. **Diagnosis:** Check if `ecommerce-db` container is running:
   ```bash
   docker ps --filter "name=ecommerce-db"
   docker logs --tail 30 ecommerce-db
   ```
3. **Mitigation:**
   ```bash
   docker start ecommerce-db
   docker compose logs -f api
   ```
   The API will automatically reconnect via its connection pool.

### Playbook 2: Negative Stock / Inventory Discrepancy Alert
1. **Diagnosis:** Run audit query on product stock history:
   ```bash
   curl -s -H "X-Admin-Token: algions-admin-secret-key-2026" \
     https://localhost/api/admin/audit-logs?entityType=PRODUCT_STOCK
   ```
2. **Resolution:**
   Reconcile physical inventory and update stock using administrative endpoint:
   ```bash
   curl -X PUT https://localhost/api/admin/products/<ID>/stock \
     -H "X-Admin-Token: algions-admin-secret-key-2026" \
     -H "Content-Type: application/json" \
     -d '{"stock": 50, "reason": "Inventory reconciliation"}'
   ```

### Playbook 3: Resiliency & Chaos Drill Demonstration
Run the automated chaos drill to demonstrate failure detection and recovery:
```bash
./scripts/chaos-drill.sh    # or: .\scripts\chaos-drill.ps1
```
