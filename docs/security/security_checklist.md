# TrustGov Production Security Checklist

This document tracks all required security hardening measures for the TrustGov prototype and verifies compliance across all architectural layers before production deployment.

---

## 1. Secrets & Environment Configuration
- [x] `.env` is included in `.gitignore` and `.dockerignore`
- [x] `.env.production.example` exists and contains only non-secret placeholders
- [x] Default development JWT secret (`super-secret-jwt-key...`) is rejected by startup guard in production mode
- [x] Startup validator (`validateEnvironment`) fails fast if `JWT_SECRET` is unset or shorter than 32 characters in production
- [x] No private keys (`*.key`, `*.pem`, `.keystore/`) are tracked in Git
- [x] Frontend build outputs (`dist/`) inspected and confirmed free of server secrets, service role keys, or database URLs

## 2. Authentication & JWT Hardening
- [x] Passwords hashed using bcrypt with salt work factor of at least 10
- [x] Passwords never returned in API payloads or printed in logs
- [x] JWT signature explicitly enforces `algorithm: 'HS256'`
- [x] JWT verification explicitly specifies `algorithms: ['HS256']` to prevent algorithm confusion attacks
- [x] Token expiration enforced (24-hour limit)
- [x] User status verified server-side on every authenticated request (`users.status === 'ACTIVE'`)
- [x] Client-tampered JWT roles are ignored; role claims are fetched directly from authoritative database record

## 3. Authorization & Role-Based Access Control (RBAC)
- [x] Admin endpoints (`/api/admin/*`) strictly restricted to `ADMIN` role
- [x] Officer portal endpoints (`/api/officer/*`) strictly restricted to `OFFICER` role
- [x] Cross-tenant IDOR protection verified: Citizen A cannot view Citizen B's reports or verifications
- [x] Missing, invalid, or expired tokens reject cleanly with HTTP 401 or 403
- [x] Public reference lookups (`TG-VFY-`, `TG-AUTH-`, `TG-REPORT-`, `TG-IVR-`) return zero PII
- [x] Confidential admin review notes are stripped from citizen-facing report details

## 4. Input Validation & Injection Defenses
- [x] Strict Zod schemas validate API request bodies
- [x] Database queries utilize parameterized placeholders (`$1, $2, ...`) without string concatenation
- [x] SQL injection payloads (`' OR '1'='1`, `DROP TABLE`) cleanly handled and rejected without SQL execution
- [x] Prototype pollution keys (`__proto__`, `constructor`) neutralized by validation schemas
- [x] XSS payloads (`<script>`, `<img onerror>`) sanitized and automatically escaped in React frontend
- [x] Path traversal sequences (`../`, `..\\`, `%2e%2e`) explicitly blocked in file uploads and reads

## 5. File Upload & Evidence Security
- [x] File extensions restricted to approved formats (`.jpg`, `.jpeg`, `.png`, `.pdf`, `.txt`, `.webp`)
- [x] Executable extensions (`.exe`, `.bat`, `.ps1`, `.sh`, `.dll`, `.js`) explicitly prohibited and rejected
- [x] Archive files (`.zip`, `.tar`, `.gz`) rejected to prevent zip bomb attacks
- [x] Maximum upload size enforced at 10 MB limit
- [x] Off-chain storage directory (`storage/evidence/`) isolated from public web server root
- [x] Server-side SHA-256 calculation at upload time; client-supplied hashes are discarded
- [x] Live integrity check recomputes bytes from disk to detect tampering (`INTEGRITY_MISMATCH`)

## 6. IVR Voice Safety & Telephony Security
- [x] Session IDs generated via CSPRNG (`TG-IVR-XXXXXXXX`) to eliminate enumeration
- [x] Caller phone numbers tokenized with SHA-256 salt (`TEL-XXXXXXXXXXXX`); raw numbers never stored
- [x] IVR session state machine enforces valid transitions (`WELCOME` -> `AWAITING_OFFICER_CODE` -> `COMPLETED`)
- [x] Expired (5-minute TTL) or terminated sessions reject subsequent DTMF inputs
- [x] Attempt limit capped at 5 attempts per session; excessive retries trigger session lock
- [x] Zero voice requests for sensitive credentials (PINs, passwords, OTPs, CVVs, UPI PINs)

## 7. Cryptography & Key Custody
- [x] Officer signing keys utilize Ed25519 standard
- [x] RFC 8785 canonical JSON formatting guarantees deterministic hash calculation across platforms
- [x] Private keys remain strictly within `KeyProvider` custody and never enter database or API responses
- [x] Challenges use cryptographically secure nonces with 5-minute expiration
- [x] Challenge replay attacks prevented: status transitions immediately to `USED` upon verification
- [x] Unauthorized officers prevented from signing challenges issued to other officers

## 8. Blockchain Smart Contract Security
- [x] `TrustGovRegistry.sol` enforces `onlyOwner` access control on all state-modifying functions
- [x] Duplicate DID registration rejected by contract
- [x] Duplicate Credential registration rejected by contract
- [x] Permanent revocation enforced: transition from `REVOKED` back to `ACTIVE` or `SUSPENDED` is forbidden
- [x] Smart contract tests pass 100% (24 / 24 test cases in Hardhat)

## 9. Network, Headers & Denial of Service
- [x] Helmet security headers active (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`)
- [x] CORS restricted to trusted origin (`FRONTEND_URL` / `CORS_ORIGINS`) in production mode
- [x] Express rate limiting active on `/api/` (100 req/15 min) with tighter limits on verification and IVR
- [x] Health check (`GET /api/health`) and readiness probe (`GET /api/ready`) return safe, non-sensitive payloads
- [x] Global error handler catches exceptions without exposing stack traces or filesystem paths

## 10. Logging, Audit & Operational Readiness
- [x] Security-sensitive actions produce structured audit events (`audit_logs`)
- [x] Audit metadata sanitized: zero passwords, JWT tokens, private keys, or raw phone numbers logged
- [x] Containerization ready: multi-stage non-root `Dockerfile` and `docker-compose.yml` configured
- [x] Complete disaster recovery and backup runbooks documented
- [x] Incident response playbooks prepared for 10 security compromise scenarios
