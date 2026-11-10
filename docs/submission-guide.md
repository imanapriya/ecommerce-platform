# Algions AI Labs - Assessment Submission Guide
**Role:** DevOps & Cloud Engineering  
**Assigned Project:** Cloud Deployment & CI/CD – E-Commerce Platform

This document contains pre-filled data, answers, and scripts to complete your official Algions AI Labs internship submission form.

---

## 1. Submission Form Field Values

| Form Field | Suggested Value / Instructions |
| :--- | :--- |
| **Student Name** | *[Enter your full legal name]* |
| **Registration Number** | *[Enter your university / college registration or roll number]* |
| **University Email** | *[Enter your institutional / university email address]* |
| **Internship Role** | `DevOps & Cloud Engineering` |
| **Assigned Project Title** | `Cloud Deployment & CI/CD – E-Commerce Platform` |
| **Repository URL** | `https://github.com/imanapriya/ecommerce-platform` *(Ensure public or reviewer access granted)* |
| **Primary Branch** | `main` |
| **Final Commit ID** | `398ca8038b043695975028c977409ddae55eb8d5` (or latest commit hash from `git rev-parse HEAD`) |
| **CI/CD Pipeline Run URL** | `https://github.com/imanapriya/ecommerce-platform/actions` *(Link to a successful GitHub Actions run)* |
| **Deployed Service URL / Mode** | `Local Deployment with Nginx Reverse Proxy (HTTPS/TLS)` *(or cloud VM IP if deployed to AWS/GCP/DigitalOcean)* |
| **Container Image Tag / Digest** | `ecommerce-api:1.0.<RUN_NUMBER>` |
| **Architecture Diagram Link** | `https://github.com/imanapriya/ecommerce-platform/blob/main/docs/architecture.md` |
| **Documentation / Runbook Link**| `https://github.com/imanapriya/ecommerce-platform/blob/main/README.md` and `docs/runbook.md` |
| **Demonstration Video Link** | *(Loom, YouTube Unlisted, or Google Drive link to your 3–5 min video)* |

---

## 2. Technology Stack & Limitations Description

### Technology Stack
- **API Runtime:** Node.js 20 (LTS), Express 4.21
- **Database Engine:** PostgreSQL 16 (Relational DB with ACID row-locking and check constraints)
- **Edge Reverse Proxy:** Nginx 1.27 Alpine with TLS 1.2/1.3, rate limiting, and HTTP-to-HTTPS redirect
- **Containerization:** Multi-stage Dockerfile running as non-root user `node` with `dumb-init` (PID 1)
- **Orchestration:** Docker Compose with isolated backend/frontend bridge networks, volume mounts, and container healthchecks
- **CI/CD Pipeline:** GitHub Actions with static linting (ESLint), dependency security audit (`npm audit`), automated integration testing against PostgreSQL service container, container image build, and Trivy CVE vulnerability scan
- **Observability:** Pino structured JSON logging with correlation IDs (`X-Request-Id`), Prometheus client metrics (`/metrics`), Liveness probe (`/healthz`), Readiness probe (`/ready`)
- **Reliability & DR:** Dual-platform automated backup/restore scripts (`pg_dump` with SHA256 checksums), zero-downtime rollback scripts, and chaos injection drills

### Assumptions & Known Limitations
1. **Scope Boundaries:** As required by the brief, this assessment implements the core product and order backend API service, rather than a full customer-facing frontend storefront or marketplace.
2. **TLS Certificates:** Self-signed certificates are bundled for local/staging demonstration; production deployments would configure Let's Encrypt / Certbot or an AWS ACM certificate.
3. **Payment Gateway:** Mock checkout order state transition; third-party payment gateways (e.g. Stripe) are represented by atomic database order creation and status transition.

---

## 3. AI Usage & Attribution Declaration

- **AI Tools Used:** Antigravity AI Coding Assistant (DeepMind)
- **Purpose of Use:** Architecture design, scaffolding boilerplate, unit/integration test generation, Dockerfile multi-stage optimization, and documentation structuring.
- **Attribution & Libraries:**
  - `express`, `pg`, `pino`, `prom-client`, `supertest`, `jest`, `selfsigned`
  - PostgreSQL 16 official image (`postgres:16-alpine`)
  - Nginx 1.27 official image (`nginx:1.27-alpine`)
- **Candidate Ownership:** All architectural decisions, transactional integrity logic (row locks, check constraints), idempotency deduplication mechanisms, and deployment configurations have been verified, tested, and can be modified during the live technical walkthrough.

---

## 4. 3–5 Minute Video Demonstration Walkthrough Script

Use this timing structure for your 3–5 minute Loom or screen recording:

| Time | Topic | What to Show on Screen |
| :--- | :--- | :--- |
| **0:00 - 0:45** | **Introduction & Architecture Overview** | Show the `docs/architecture.md` diagram. State your name, role (DevOps & Cloud Engineering), and explain the 3 tiers (Nginx TLS proxy, Node.js API with non-root user, PostgreSQL with persistent volumes). |
| **0:45 - 1:45** | **CI/CD Pipeline Walkthrough** | Open GitHub Actions tab. Show a successful workflow run showing all 4 stages: (1) Lint & npm audit, (2) Integration tests against Postgres container (21 passed), (3) Docker Build & Trivy security scan, (4) Deployment configuration validation. |
| **1:45 - 2:45** | **Live Deployed API & Idempotency** | Open terminal / Postman. Run `curl -k https://localhost/ready` (show 200 OK). Execute checkout request with `Idempotency-Key: TEST-01`. Show order created (201). Re-send the exact same request. Show 200 OK with `X-Idempotent-Replay: true` and explain why stock was NOT double-deducted! |
| **2:45 - 3:45** | **Chaos Drill & Self-Healing Detection** | Run `./scripts/chaos-drill.sh` (or `.\scripts\chaos-drill.ps1`). Point out: (1) DB stops, (2) `/ready` immediately returns 503, (3) structured JSON error logs appear with correlation ID, (4) DB restarts, (5) `/ready` automatically recovers to 200 without container restart. |
| **3:45 - 4:30** | **Backup, Restore & Rollback** | Run `./scripts/backup.sh`. Show the compressed dump and SHA256 checksum generated. Explain the zero-downtime rollback procedure in `scripts/rollback.sh`. Conclude presentation. |
