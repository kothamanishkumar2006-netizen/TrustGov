# TRUSTGOV PHASE 13 — PRODUCTION DEPLOYMENT PLAN & ARCHITECTURE ROADMAP

**Document Version:** 1.0 (Phase 13 Productization)  
**Status:** PROPOSED & READY FOR APPROVAL (No infrastructure provisioned without explicit user consent)  
**Target Environments:** Staging (Ethereum Sepolia + AWS/Supabase), Production (Ethereum Consortium/L2 + High-Availability Cloud)  

---

## 1. EXECUTIVE DEPLOYMENT PRINCIPLES

1. **Zero Secret Hardcoding:** All production secrets (database credentials, KMS keys, JWT secrets, telephony auth tokens) injected exclusively via secure runtime environment managers (e.g., AWS Secrets Manager, HashiCorp Vault, Supabase Secrets).
2. **Strict Approval Gateways:** Zero paid services, cloud subscriptions, domain registrations, or public blockchain transactions will be initiated without explicit written approval from the repository owner.
3. **Non-Root & Immutability:** Docker containers run under unprivileged user `node`, with read-only root filesystems and external mounted persistent storage.
4. **Authoritative Server Security:** Zero client-side trust; cryptographic signatures, proof-of-possession verification, and risk authorization rules derive exclusively on the backend.

---

## 2. SUBSYSTEM DEPLOYMENT SPECIFICATIONS

### 2.1. Managed PostgreSQL & Schema Migration
- **Target Provider:** Supabase Managed PostgreSQL or AWS RDS PostgreSQL (Multi-AZ).
- **Security Requirements:**
  - Enforce SSL in transit (`sslmode=require`).
  - Network isolation: Database accessible only from VPC private subnets and container IP pools.
  - Connection pooling: PgBouncer / Supabase Connection Pooler for horizontal scaling.
- **Migration Plan:**
  - Sequentially execute existing SQL migrations in `database/migrations/`:
    - `01_init.sql` through `10_ivr_sessions.sql`.
  - Automated CI/CD migration runner executing via GitHub Actions / GitLab CI runner with rollback check.
- **Backup & Disaster Recovery Strategy:**
  - Automated daily snapshots retained for 30 days.
  - Point-in-Time Recovery (PITR) enabled with 7-day write-ahead log retention.
  - Automated cold backup exported weekly to encrypted off-site cloud storage.

### 2.2. Master Key Custody & HSM / KMS Architecture
- **Target Provider:** AWS CloudHSM, AWS KMS, or HashiCorp Vault Transit Engine.
- **Ed25519 Authority Key Custody:**
  - The TrustGov Issuance Authority DID (`did:trustgov:authority:issuance`) signing private key must **never** touch disk or persistent database storage.
  - All credential signing (`createAndSignCredential`) and proof validation operations delegated to KMS asymmetric sign operations (`Ed25519` / `NIST-P256`).
- **Officer Key Custody:**
  - Officers utilize hardware-backed security (FIDO2 WebAuthn / Secure Enclave on government devices) or encrypted KMS key namespaces.
- **Development-to-Production Transition:**
  - Retire local `.keystore/` mock directory.
  - Configure `backend/src/services/keyProvider.ts` to route signing requests through cloud KMS APIs using IAM instance roles.

### 2.3. Smart Contract Registry Deployment & Verification
- **Target Network Options:**
  - **Staging / Public Testnet:** Ethereum Sepolia (Chain ID 11155111).
  - **Production Consortium:** Polygon PoS (Chain ID 137), Arbitrum One (Chain ID 42161), or a dedicated Government Permissioned L2 (Avalanche Subnet / Hyperledger Besu).
- **Deployment Procedure:**
  ```bash
  # Compile Hardhat smart contract
  cd blockchain
  npm run compile

  # Deploy to Sepolia testnet using secure deployer key
  npx hardhat run scripts/deploy-registry.ts --network sepolia
  ```
- **Contract Verification:**
  - Verify bytecode and ABI on Etherscan / Blockscout using Hardhat Verify plugin:
    ```bash
    npx hardhat verify --network sepolia <DEPLOYED_CONTRACT_ADDRESS>
    ```
- **Backend Configuration:**
  - Update `TRUSTGOV_REGISTRY_ADDRESS` and `BLOCKCHAIN_RPC_URL` in production backend environment.

### 2.4. Telephony Voice Gateway (IVR) Integration
- **Target Telephony Carrier:** Twilio Voice Webhooks or Exotel Telephony Gateway.
- **Configuration Steps:**
  1. Provision verified institutional telephone number (e.g., National Toll-Free `1800-XXX-XXXX` or localized virtual DID).
  2. Configure inbound voice webhook URL:
     `POST https://api.trustgov.gov.in/api/ivr/webhook/voice`
  3. Enforce cryptographic webhook signature validation (`X-Twilio-Signature` matching auth token).
  4. Enable dual DTMF input and speech-to-text recognition (English + regional language models).
  5. Configure automated session lockout (max 5 failed attempts transitions state to `LOCKED`).

### 2.5. Evidence Vault & Storage Hardening
- **Target Provider:** AWS S3 or Supabase Storage with Object Lock (WORM — Write Once, Read Many).
- **Configuration & Policies:**
  - SSE-KMS (Server-Side Encryption with Customer Master Key).
  - Enforce 10MB maximum upload ceiling via API gateway and Nginx proxy.
  - Strict MIME-type validation (PNG, JPEG, PDF, TXT only; executables `.exe`, `.bat`, `.sh` strictly rejected).
  - Server-calculated SHA-256 integrity digest stored immutably in `report_evidence` table.

---

## 3. NETWORK, DOMAIN & SECURITY HARDENING

### 3.1. Reverse Proxy & Edge Security (Nginx / Cloudflare)
- **Edge CDN & WAF:** Cloudflare Enterprise or AWS CloudFront with WAF managed rules (OWASP Top 10, anti-DDoS).
- **SSL/TLS Termination:**
  - Strict TLS 1.3 enforcement with fallback to TLS 1.2.
  - HSTS enabled: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
  - Qualys SSL Labs rating target: A+.

### 3.2. CORS & Origin Locking
- Strict origin restriction in `backend/src/server.ts`:
  ```bash
  CORS_ORIGINS=https://verify.trustgov.gov.in,https://admin.trustgov.gov.in
  ```
- Rejection of wildcard `*` origins in production mode (enforced by `envValidation.ts`).

### 3.3. Rate Limiting & DoS Defense
- **General API Limiter:** 100 requests per 15 minutes per external client IP.
- **Verification Limiter:** 60 requests per 5 minutes on `/api/verification/` and `/api/citizen/` endpoints.
- **IVR Call Start Limiter:** 10 call sessions per 10 minutes per telephone caller ID.

---

## 4. PRE-REQUISITE APPROVALS & ESTIMATED COST SCHEDULE

Before proceeding with any live infrastructure provisioning, the following user approvals and prerequisites must be formally authorized:

| Prerequisite Component | Provider / Platform | Estimated Monthly Cost | Approval Required |
| :--- | :--- | :---: | :---: |
| **Cloud Virtual Server (2x App Nodes)** | AWS EC2 (t4g.medium) or DigitalOcean Droplet | ~$40 – $70 / mo | **PENDING USER APPROVAL** |
| **Managed Database (High Availability)** | Supabase Pro or AWS RDS PostgreSQL (db.t4g.medium) | ~$25 – $65 / mo | **PENDING USER APPROVAL** |
| **Blockchain Gas & Anchoring** | Ethereum Sepolia (Free testnet) / Polygon Mainnet ($10 gas pool) | ~$0 – $15 / mo | **PENDING USER APPROVAL** |
| **Telephony Gateway & Toll-Free DID** | Twilio / Exotel Voice Minutes & Phone Number Rental | ~$15 – $40 / mo | **PENDING USER APPROVAL** |
| **Institutional Domain & SSL Certificate** | Cloudflare / Government DNS Authority (`.gov.in`) | ~$15 – $30 / yr | **PENDING USER APPROVAL** |
| **Total Estimated Initial Budget** | — | **~$80 – $190 / mo** | **PENDING USER APPROVAL** |

---

## 5. PHASED EXECUTION TIMELINE

```
Phase 13A: Architecture Review & Approvals (Current Milestone)
  └── Present Local Demo & Review Deployment Plan
  └── Secure User Authorizations for Cloud Resources

Phase 13B: Staging Infrastructure Provisioning (Post-Approval)
  ├── Set up Cloudflare DNS & SSL certificates
  ├── Provision Managed PostgreSQL & execute 10 SQL migrations
  ├── Deploy TrustGovRegistry.sol to Sepolia testnet & verify on Etherscan
  └── Connect Twilio Voice staging webhook

Phase 13C: Staging Acceptance & Penetration Retest
  ├── Run 387 automated regression tests against live staging API
  ├── Perform automated browser E2E test on staging URL
  └── Validate end-to-end phone call verification via real telephone

Phase 13D: Production Launch
  ├── Switch to production KMS key custody
  ├── Enable automated daily database backups & PITR
  └── Public launch of TrustGov Verification Portal
```
