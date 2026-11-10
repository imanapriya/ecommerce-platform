# Architecture & System Design Specification
**Project:** Cloud Deployment & CI/CD – E-Commerce Platform  
**Target Domain:** E-Commerce Product & Order Service  
**Organization:** ALGIONS AI LABS PRIVATE LIMITED

---

## 1. System Topology & Network Architecture

The deployment topology enforces least privilege, defense-in-depth, network tier isolation, and secure TLS termination.

```mermaid
flowchart TD
    Client["Client / Evaluator / Browser"]

    subgraph EdgeTier["Edge Tier (Public Network)"]
        Nginx["Nginx Reverse Proxy\n(TLS 1.3 / HTTP/2 / Rate Limiter)\nPort 80 -> 443 Redirect"]
    end

    subgraph AppTier["Application Tier (Internal Network: ecommerce-frontend)"]
        API["Node.js E-Commerce API\n(Non-Root 'node' user, PID 1 dumb-init)\nPort 3000"]
    end

    subgraph DataTier["Database Tier (Internal Network: ecommerce-backend)"]
        PG["PostgreSQL 16 Relational Engine\n(ACID Row-Locking, Check Constraints)\nPort 5432 (Internal Only)"]
        Volume[("Persistent Storage Volume\necommerce_db_data")]
    end

    subgraph Observability["Observability Subsystem"]
        Pino["Structured JSON Logger\n(Correlation ID: X-Request-Id)"]
        Prom["Prometheus Metrics Endpoint\n(/metrics)"]
        Probes["Liveness (/healthz)\nReadiness (/ready)"]
    end

    Client -- "HTTPS (443)\nHTTP (80 Redirect)" --> Nginx
    Nginx -- "Reverse Proxy\nX-Request-Id, Rate-Limited" --> API
    API -- "Internal Connection Pool\n(ACID Transactions, Row Locks)" --> PG
    PG --- Volume
    API --> Pino
    API --> Prom
    API --> Probes
```

---

## 2. Idempotent Checkout & Atomic Inventory Workflow

Acceptance Test #1 mandates that repeated checkout requests with the same idempotency key must not create duplicate orders or double-deduct inventory.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Client
    participant Proxy as Nginx Proxy
    participant API as E-Commerce API
    participant DB as PostgreSQL 16

    Customer->>Proxy: POST /api/orders (Header: Idempotency-Key: UUID)
    Proxy->>API: Forward request with X-Request-Id
    
    API->>DB: SELECT * FROM orders WHERE idempotency_key = $key
    alt Key already exists (Idempotent Replay)
        DB-->>API: Returns existing order record
        API-->>Customer: 200 OK (X-Idempotent-Replay: true, original order payload)
    else First checkout attempt (New Order)
        API->>DB: BEGIN TRANSACTION
        loop For each order item
            API->>DB: SELECT * FROM products WHERE id = $id FOR UPDATE
            Note over DB: Locks product row exclusively
            alt Insufficient Stock / Inactive
                API->>DB: ROLLBACK
                API-->>Customer: 400 Bad Request (Insufficient Stock)
            else Stock Available
                API->>DB: UPDATE products SET stock = stock - qty
                Note over DB: Atomic deduction; DB CHECK constraint prevents stock < 0
            end
        end
        API->>DB: INSERT INTO orders (...)
        API->>DB: INSERT INTO order_items (...) with price snapshot
        API->>DB: INSERT INTO audit_logs (...)
        API->>DB: COMMIT TRANSACTION
        API-->>Customer: 201 Created (X-Idempotent-Replay: false, new order details)
    end
```

---

## 3. Resiliency & Chaos Drill Workflow (Acceptance Test #4)

Demonstrates automatic failure detection and self-healing when a critical backend service fails and recovers.

```mermaid
sequenceDiagram
    autonumber
    actor SRE as SRE / Chaos Operator
    participant API as E-Commerce API
    participant Probe as Orchestrator / Probes
    participant DB as PostgreSQL DB

    Note over API,DB: State: Normal Operation
    Probe->>API: GET /ready
    API->>DB: SELECT 1
    DB-->>API: OK (latency: 2ms)
    API-->>Probe: 200 OK {"status": "ready", "database": "healthy"}

    Note over SRE,DB: Fault Injection: Stop Database Container
    SRE->>DB: docker stop ecommerce-db
    
    Probe->>API: GET /ready
    API->>DB: Connection Attempt (Connection Refused)
    API-->>Probe: 503 Service Unavailable {"status": "unhealthy", "ready": false}
    Note over API: Emits structured error log with correlation ID

    Note over SRE,DB: Recovery: Restart Database Container
    SRE->>DB: docker start ecommerce-db
    DB-->>DB: Startup and initialize
    
    Probe->>API: GET /ready
    API->>DB: Pool reconnects (SELECT 1)
    DB-->>API: OK
    API-->>Probe: 200 OK {"status": "ready", "database": "healthy"}
    Note over SRE,API: System self-healed without application container restart!
```

---

## 4. CI/CD Pipeline Architecture

```mermaid
flowchart LR
    GitPush["Git Push / PR\n(main branch)"] --> Lint["Stage 1: Lint & Audit\n- ESLint Flat Config\n- npm audit --audit-level=high"]
    Lint --> Test["Stage 2: Integration Tests\n- PostgreSQL 16 Service Container\n- In-Memory Emulator\n- 100% Test Pass Rate\n- Coverage Artifact"]
    Test --> Build["Stage 3: Build & Security\n- Docker Buildx Multi-Stage\n- Trivy Container CVE Scan\n- Non-Root User Verification\n- Semantic Version Tagging"]
    Build --> DeployVal["Stage 4: Deployment Validation\n- Docker Compose Config Validate\n- Release Manifest Generation\n- Rollback Target Verification"]
```

---

## 5. Security & Isolation Controls

| Security Control | Implementation |
| :--- | :--- |
| **Non-Root Execution** | Application runs as unprivileged user `node` (`UID 1000`) inside container |
| **Process Supervision** | `dumb-init` runs as PID 1 to handle SIGTERM/SIGINT signals cleanly |
| **Network Segmentation** | Database container is isolated on `ecommerce-backend` network and not exposed to the public internet |
| **TLS/SSL Encryption** | Nginx terminates TLS 1.2 and 1.3 with modern AEAD cipher suites |
| **Secret Management** | Credentials passed via environment variables; `.gitignore` prevents secret check-in |
| **Database Constraints** | `CHECK (stock >= 0)` enforces at database engine level that stock can never become negative |
| **Rate Limiting** | Nginx enforces 15 req/sec with burst buffer to mitigate DoS / brute-force abuse |
| **Administrative RBAC** | Admin stock updates require `X-Admin-Token` and record full audit entries with actor details |
