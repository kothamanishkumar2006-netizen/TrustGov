# TrustGov Production Deployment Guide

## 1. Prerequisites
Before deploying TrustGov to a staging or production environment, ensure the following infrastructure and dependencies are prepared:

- **Node.js**: Version 20 LTS or higher
- **PostgreSQL**: Version 14 or higher (PostgreSQL 15 recommended) with SSL enabled
- **Docker & Docker Compose**: (Optional, for containerized deployments)
- **EVM Blockchain RPC**: Ethereum Sepolia testnet, Polygon Amoy, or private Consortium L2 network endpoint
- **Telephony Provider**: Twilio, Exotel, or Plivo account (if live IVR voice gateway is activated)
- **SSL/TLS Certificates**: Valid certificates from Let's Encrypt or corporate CA for API and frontend domains

---

## 2. Environment Configuration
Create a production `.env` file based on `.env.production.example`:

```bash
cp .env.production.example .env
```

Configure the following critical variables:
```ini
NODE_ENV=production
PORT=5000

# PostgreSQL Connection
DATABASE_URL=postgresql://trustgov_user:STRONG_PASS@db.internal:5432/trustgov_production?sslmode=require

# Authentication Secrets (Must be at least 32 characters, high-entropy)
JWT_SECRET=c8f5e1289b4a7061d368e745672abef90123456789abcdef0123456789abcdef
JWT_ISSUER=trustgov-auth-service
JWT_AUDIENCE=trustgov-api

# CORS & Frontend Origins
FRONTEND_URL=https://verify.trustgov.gov.in
CORS_ORIGINS=https://verify.trustgov.gov.in,https://admin.trustgov.gov.in

# Blockchain Anchor
BLOCKCHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
BLOCKCHAIN_PRIVATE_KEY=YOUR_DEPLOYER_PRIVATE_KEY
TRUSTGOV_REGISTRY_ADDRESS=0x1234567890123456789012345678901234567890

# IVR Telephony
IVR_PROVIDER=twilio
IVR_PROVIDER_API_KEY=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
IVR_PROVIDER_SECRET=your_auth_token
```

---

## 3. Database Migration Sequence
Migrations must be executed sequentially on the PostgreSQL database:

```bash
# Order of migrations
psql -U $DB_USER -d $DB_NAME -f database/migrations/01_initial_schema.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/02_officer_management.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/03_did_identities.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/04_verifiable_credentials.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/05_blockchain_registry.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/06_challenge_response.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/07_citizen_verification_history.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/08_authorization_policies.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/08_authorization_evaluations.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/09_scam_reports.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/09_report_evidence.sql
psql -U $DB_USER -d $DB_NAME -f database/migrations/10_ivr_sessions.sql
```

---

## 4. Backend Build & Service Startup

### Standard Node.js Deployment:
```bash
cd backend
npm ci --only=production
npm run build
node dist/server.js
```

### Docker Deployment:
```bash
docker-compose up -d --build
```

---

## 5. Frontend Build & Static Serving
Compile the Vite React frontend:
```bash
cd frontend
npm ci
npm run build
```
Deploy the generated `dist/` directory to an Nginx, AWS S3 + CloudFront, or Cloudflare Pages web server with standard Single Page Application (SPA) fallback routing.

---

## 6. Post-Deployment Verification & Smoke Tests

### 6.1 Health & Readiness Probes
```bash
# Verify process liveness
curl -fsS http://localhost:5000/api/health
# Expected: {"status":"ok","service":"trustgov","timestamp":"..."}

# Verify dependency readiness
curl -fsS http://localhost:5000/api/ready
# Expected: {"status":"ready","service":"trustgov","database":"connected","timestamp":"..."}
```

### 6.2 Security Header Verification
```bash
curl -I http://localhost:5000/api/health
```
Verify the presence of:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 6.3 Verification Flow Smoke Test
1. Log in to Admin portal and confirm officer directory loads.
2. Open Citizen verification portal and verify officer `TG-OFF-001`.
3. Check action evaluation for `REQUEST_UPI_PAYMENT` and verify `DENY / CRITICAL` output.
4. Access IVR simulator and test dialing `TG-OFF-001`.

---

## 7. Rollback Procedure
If unexpected errors occur post-deployment:
1. Revert container image or Git commit:
   ```bash
   git checkout <PREVIOUS_STABLE_TAG>
   npm run build
   ```
2. Revert breaking database migrations using reverse SQL scripts.
3. Restart backend service and verify `/api/health`.
