# TRUSTGOV DEPLOYMENT READINESS & PRODUCTION SECURITY AUDIT

**Target Platform:** Docker / Linux Containerized Runtime / Cloud Virtual Private Network  
**Specification Level:** Phase 12 Final Productization  
**Review Date:** 2026-10-11  

---

## 1. PRODUCTION READINESS CHECKLIST MATRIX

| Domain / Control | Implementation in Codebase | Audit Status | Production Hardening Action Required |
| :--- | :--- | :---: | :--- |
| **Startup Guardrails** | `backend/src/config/envValidation.ts` enforces non-empty, strong JWT secrets (>32 chars) and database settings on boot | **VERIFIED** | Enforce environment variables in production orchestration (Kubernetes / ECS). |
| **Non-Root Execution** | `Dockerfile` creates `node` user and runs `USER node` with minimal Alpine base image | **VERIFIED** | Confirm container host enforces read-only root filesystem where feasible. |
| **Secret Management** | `.env`, `.keystore/`, `storage/` are excluded in `.gitignore` and `.dockerignore` | **VERIFIED** | Inject secrets at runtime using AWS Secrets Manager, Vault, or GCP Secret Manager. |
| **Security Headers** | Helmet middleware configured in `server.ts` with strict CSP, Frameguard (`DENY`), and nosniff | **VERIFIED** | Configure reverse-proxy (Nginx / Caddy) to append HSTS header (`Strict-Transport-Security`). |
| **CORS Policy** | Origin validation rejects untrusted domains; wildcard `*` explicitly prohibited in production | **VERIFIED** | Configure production domains in `CORS_ORIGINS` / `FRONTEND_URL`. |
| **Health Telemetry** | Safe, zero-secret `/api/health` and `/api/ready` endpoints exposed | **VERIFIED** | Wire endpoints to Kubernetes liveness and readiness probes. |
| **Database Migrations** | 12 sequential SQL migrations in `database/migrations/` | **VERIFIED** | Execute migrations via CI/CD pipeline step prior to container rollout. |
| **Evidence Vault** | File type whitelist, 10MB limit, server-side SHA-256 calculation | **VERIFIED** | Mount encrypted persistent block volume or migrate to S3 with Object Lock. |
| **Telephony Gateway** | IVR provider abstraction supporting Twilio / Exotel webhooks | **VERIFIED** | Configure telephony webhook signatures (`X-Twilio-Signature`) and TLS. |
| **Production Build** | `npm run build` compiles TypeScript backend cleanly and bundles Vite frontend | **VERIFIED** | Use multi-stage Docker build pipeline for optimized release artifacts. |

---

## 2. CONFIGURATION & SECRETS MANAGEMENT

### Environment Variable Standards
Refer to `.env.production.example` for the authoritative template.

#### Critical Security Variables
- `NODE_ENV`: Must be explicitly set to `production`.
- `PORT`: Default `5000` (internal container port).
- `DATABASE_URL`: Full PostgreSQL connection string with SSL (`sslmode=require`).
- `JWT_SECRET`: High-entropy random secret (minimum 64 characters).
  ```bash
  # Secure secret generation command:
  openssl rand -base64 64
  ```
- `CORS_ORIGINS`: Comma-separated list of approved frontend origins (e.g., `https://verify.trustgov.gov.in,https://admin.trustgov.gov.in`).
- `STORAGE_DIRECTORY`: Path to persistent storage volume (e.g., `/app/storage/evidence`).

### Secret Protection Guardrails
1. **Never bake secrets into images:** The multi-stage `Dockerfile` contains zero embedded environment variables or credentials.
2. **Never commit keystores:** The development key custody directory (`.keystore/`) is ignored in version control.
3. **Automated Boot Abort:** If `NODE_ENV=production` and `JWT_SECRET` contains a placeholder or is under 32 characters, the backend exits immediately with exit code 1.

---

## 3. CONTAINER DEPLOYMENT ARCHITECTURE

### Multi-Stage Dockerfile (`Dockerfile`)
- **Stage 1 (Builder):** Uses `node:20-alpine`, installs build tools, compiles TypeScript (`tsc`), and bundles Vite (`vite build`).
- **Stage 2 (Runner):** Uses a clean `node:20-alpine` base, installs only production dependencies (`npm ci --only=production`), copies build artifacts, creates the evidence directory with `chown -R node:node /app`, switches to `USER node`, and runs healthchecks.

### Container Launch via Docker Compose
```bash
# Production container deployment
docker compose -f docker-compose.yml up -d --build
```

### Container Healthcheck Configuration
- **Interval:** 15 seconds
- **Timeout:** 5 seconds
- **Retries:** 3
- **Command:** `wget -qO- http://localhost:5000/api/health || exit 1`

---

## 4. DATABASE MIGRATION PROCEDURE

TrustGov uses standard SQL migrations located in `database/migrations/`:
1. `01_init.sql` — Users, audit logs, core schema.
2. `02_officer_management.sql` — Government officer registry.
3. `03_did_identities.sql` — W3C DID bindings and Ed25519 public keys.
4. `04_verifiable_credentials.sql` — W3C Verifiable Credentials store.
5. `05_blockchain_registry.sql` — On-chain anchor transaction records.
6. `06_challenge_response.sql` — Proof-of-possession challenges and nonces.
7. `07_citizen_verification_history.sql` — Citizen verification event logs.
8. `08_authorization_evaluations.sql` — Request evaluation records.
9. `08_authorization_policies.sql` — Authoritative risk and safety policies.
10. `09_report_evidence.sql` — Cryptographic file evidence and SHA-256 digests.
11. `09_scam_reports.sql` — Incident reports and review notes.
12. `10_ivr_sessions.sql` — Telephony voice sessions and DTMF states.

### Executing Migrations in Production
```bash
# Run migrations via PostgreSQL client against production database
psql "$DATABASE_URL" -f database/migrations/01_init.sql
# ... run sequential migration files ...
```
*Note: In Docker Compose, the `database/migrations` directory is mapped to `/docker-entrypoint-initdb.d:ro` for automated first-boot initialization.*

---

## 5. REVERSE PROXY & SSL/TLS TERMINATION

The TrustGov container must sit behind a production reverse proxy (Nginx, AWS ALB, or Cloudflare) with TLS 1.3 enforced:

### Sample Nginx Configuration Snippet
```nginx
server {
    listen 443 ssl http2;
    server_name verify.trustgov.gov.in;

    ssl_certificate /etc/letsencrypt/live/verify.trustgov.gov.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/verify.trustgov.gov.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Static Frontend
    location / {
        root /var/www/trustgov-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 12M;
    }
}
```

---

## 6. BACKUP, RESTORE & ROLLBACK PROCEDURES

### Database Backup
```bash
# Automated database backup
pg_dump -Fc --no-acl --no-owner -d "$DATABASE_URL" > /backup/trustgov_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore
```bash
# Database restore from backup
pg_restore --clean --if-exists -d "$DATABASE_URL" /backup/trustgov_<timestamp>.dump
```

### Application Rollback
Because TrustGov Docker containers are version-tagged and stateless (with persistent storage mounted externally):
1. Tag previous stable release: `trustgov-api:v1.0.0`.
2. To rollback, update compose service tag to previous version:
   ```bash
   docker compose down
   docker compose up -d
   ```
3. Health check verifies service readiness immediately via `/api/ready`.

---

## 7. HONEST OPERATIONAL STATUS & LIMITATIONS

| Area | Current Implementation State | Production Requirement |
| :--- | :--- | :--- |
| **Smart Contract** | Local Hardhat EVM verified with 24 passing unit tests. Bytecode and ABI generated. | Deploy `TrustGovRegistry.sol` to public testnet (Sepolia) or consortium EVM and configure KMS private key. |
| **Database** | In-Memory Engine provides complete test isolation; PostgreSQL schema ready. | Provision high-availability PostgreSQL with automated daily snapshots. |
| **Key Custody** | Ed25519 multibase key generation with zero database exposure. | Integrate Hardware Security Module (HSM) or AWS KMS for master authority keys. |
| **Telephony** | Interactive in-browser DTMF simulator tested with voice synthesis. | Register commercial telephone toll-free number and connect Twilio / Exotel webhooks. |
