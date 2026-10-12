# TrustGov Security Threat Model

## 1. Overview & System Scope
TrustGov is a prototype security architecture designed to empower citizens to verify individuals claiming to be government officers, evaluate whether requested actions (such as fund transfers or credential demands) are authorized by official policy, preserve non-repudiable evidence of suspicious interactions, and provide an accessible IVR voice gateway.

This threat model documents the 35 critical security threats evaluated across Phases 1 through 11, their respective attack surfaces, baseline security controls, Phase 11 hardening measures, and automated regression test mappings.

---

## 2. Threat Analysis Matrix (35 Threat Vectors)

### 1. Fake Officer Impersonation
- **Threat**: An impostor claims to be an officer from a law enforcement agency (e.g., CBI, Police, ED) and attempts to intimidate a citizen.
- **Attack Surface**: Citizen verification endpoint (`POST /api/citizen/verify`), IVR verification bridge (`verifyOfficerForIvr`).
- **Existing Control**: Cryptographic registry requiring active officer database record, W3C Verifiable Credential signature, and matching DID identity.
- **Hardening**: Tiered multi-point checks: Officer status must be `ACTIVE`, credential status `ACTIVE`, and smart contract anchored.
- **Test**: `phase7_citizen_verification.test.cjs` / `phase11_security.test.cjs` (Test A6, B1).

### 2. Credential Forgery
- **Threat**: Attacker creates a forged Verifiable Credential claiming officer status.
- **Attack Surface**: `POST /api/credentials/verify`, `POST /api/citizen/verify`.
- **Existing Control**: Ed25519 digital signature verified against Issuer Authority public key (`ISSUER_DID`).
- **Hardening**: RFC 8785 canonicalization prevents malleability; signature verification strictly enforced before parsing payload claims.
- **Test**: `phase4_credentials.test.cjs` / `phase11_security.test.cjs` (Test E1).

### 3. Credential Tampering
- **Threat**: Attacker modifies claims within a genuine credential (e.g., changing designation or jurisdiction).
- **Attack Surface**: Credential JSON payload submission.
- **Existing Control**: Any byte modification alters the RFC 8785 canonical hash and breaks the Ed25519 signature.
- **Hardening**: Complete payload canonicalization recomputed server-side on every verification.
- **Test**: `phase4_credentials.test.cjs` / `phase11_security.test.cjs` (Test E1).

### 4. DID Manipulation
- **Threat**: Attacker attempts to bind an officer's identity to a rogue DID document or malicious public key.
- **Attack Surface**: `POST /api/did/generate`, `POST /api/admin/officers/:id/blockchain-anchor-did`.
- **Existing Control**: Strict 1:1 binding between officer database ID, DID document, and smart contract registry.
- **Hardening**: DID generation restricted to Admin role; duplicate DID registration rejected by smart contract.
- **Test**: `phase3_did.test.cjs` / `phase5_blockchain.test.cjs`.

### 5. Private-Key Theft
- **Threat**: Compromise of officer Ed25519 signing keys or authority issuer keys.
- **Attack Surface**: Database queries, API responses, frontend bundles, version control.
- **Existing Control**: KeyProvider abstraction keeps private keys out of PostgreSQL, Supabase, JWTs, and API responses.
- **Hardening**: `.keystore/` ignored in Git and Docker; `.key` and `.pem` file masks ignored; memory-vault isolation.
- **Test**: `phase11_security.test.cjs` (Test E5, Category E).

### 6. Challenge Replay Attack
- **Threat**: Attacker intercepts an officer's signed challenge and replays it to impersonate the officer in a subsequent session.
- **Attack Surface**: `POST /api/verification/verify-proof`.
- **Existing Control**: Nonce-based challenges with 5-minute TTL; once used, status immediately transitions from `PENDING` to `USED`.
- **Hardening**: Database transactional transition prevents concurrent replay race conditions.
- **Test**: `phase6_challenge_response.test.cjs` / `phase11_security.test.cjs` (Test E2).

### 7. Challenge Tampering
- **Threat**: Citizen or attacker modifies the audience or nonce inside a challenge payload.
- **Attack Surface**: `POST /api/verification/verify-proof`.
- **Existing Control**: Recomputed canonical JSON hash verified against the signature with the officer's registered public key.
- **Hardening**: Mismatched nonce or audience immediately triggers signature verification failure.
- **Test**: `phase6_challenge_response.test.cjs` / `phase11_security.test.cjs` (Test E4).

### 8. QR Payload Manipulation
- **Threat**: Attacker crafts a malicious QR code claiming to be TrustGov verification URI with phishing parameters.
- **Attack Surface**: `POST /api/verification/qr-resolve`, `POST /api/citizen/verify`.
- **Existing Control**: Strict URI regex parser enforcing `TRUSTGOV://verify/<id>` format.
- **Hardening**: Rejection of arbitrary URLs, script injections, or unrecognized parameters.
- **Test**: `phase6_qr.test.cjs` / `phase7_citizen_verification.test.cjs`.

### 9. Officer Enumeration
- **Threat**: Attacker probes verification endpoints to discover valid officer codes or contact details.
- **Attack Surface**: `POST /api/citizen/verify`, IVR verification (`/api/ivr/session/:id/input`).
- **Existing Control**: Generic failure responses on non-existent officer queries; rate limiting on verification attempts.
- **Hardening**: Anti-enumeration returns identical error shapes without revealing whether an officer code exists in the registry.
- **Test**: `phase10_ivr.test.cjs` / `phase11_security.test.cjs` (Test H4).

### 10. Citizen Account Compromise
- **Threat**: Attacker gains unauthorized access to a citizen's account.
- **Attack Surface**: `/api/auth/login`.
- **Existing Control**: Bcrypt password hashing (10 salt rounds); JWT token expiration.
- **Hardening**: Failed login auditing (`FAILED_LOGIN_ATTEMPT`); server-side user status verification on every token check.
- **Test**: `phase11_security.test.cjs` (Test A6, A7).

### 11. Admin Account Compromise
- **Threat**: Attacker escalates privileges or gains access to Admin credentials.
- **Attack Surface**: `/api/admin/*`.
- **Existing Control**: Strict RBAC middleware (`authorizeRoles('ADMIN')`); token role claims validated against database.
- **Hardening**: Server-side user role lookup ignores any client-supplied role tampering; admin actions produce persistent audit logs.
- **Test**: `phase11_security.test.cjs` (Test B1, B3).

### 12. Authorization Manipulation
- **Threat**: Client attempts to force an `ALLOW` decision or override `CRITICAL` risk for prohibited payment requests.
- **Attack Surface**: `POST /api/citizen/authorization/evaluate`.
- **Existing Control**: Server-side deterministic policy engine; evaluates rules independently of client inputs.
- **Hardening**: Any client-provided `decision`, `riskLevel`, or `override` field is discarded; only `actionCode` and `officerReference` are consumed.
- **Test**: `phase8_authorization.test.cjs` / `phase11_security.test.cjs` (Test G1, G2).

### 13. Evidence Tampering
- **Threat**: Malicious actor alters stored screenshot or audio evidence to corrupt investigation records.
- **Attack Surface**: Local file storage (`storage/evidence/`).
- **Existing Control**: Server-side SHA-256 calculation at upload time stored in database and blockchain anchor.
- **Hardening**: Live byte recalculation on every integrity check (`verifyEvidenceIntegrity`); mismatches flagged as `INTEGRITY_MISMATCH`.
- **Test**: `phase9_scam_reporting.test.cjs` / `phase11_security.test.cjs` (Test F5).

### 14. Evidence Unauthorized Access
- **Threat**: Attacker accesses or downloads evidence submitted by another citizen.
- **Attack Surface**: `GET /api/citizen/reports/:reportId/evidence/:evidenceId/file`.
- **Existing Control**: Strict IDOR check: Report must belong to authenticated `citizen_id` or user must possess `ADMIN` role.
- **Hardening**: Returns generic 404 `RECORD_NOT_FOUND` if record belongs to another user (zero information leak).
- **Test**: `phase9_scam_reporting.test.cjs` / `phase11_security.test.cjs` (Test B5).

### 15. Report Privacy Breach
- **Threat**: Citizen reports containing sensitive descriptions or confidential admin notes are exposed to unauthorized users.
- **Attack Surface**: `GET /api/citizen/reports/:reportId`.
- **Existing Control**: Tenant isolation filters queries by `citizen_id`.
- **Hardening**: Admin review notes are explicitly stripped from citizen view responses.
- **Test**: `phase9_scam_reporting.test.cjs` / `phase11_security.test.cjs` (Test I4).

### 16. IVR Enumeration
- **Threat**: Attacker sends repeated automated DTMF tones to enumerate officer database entries over phone gateway.
- **Attack Surface**: `POST /api/ivr/session/:id/input`.
- **Existing Control**: Max 5 officer code attempts per IVR session; session locked upon exhaustion.
- **Hardening**: Dedicated IVR rate limiting (`ivrCallLimiter`, `ivrInputLimiter`).
- **Test**: `phase10_ivr.test.cjs` / `phase11_security.test.cjs` (Test H4, H5).

### 17. IVR Session Hijacking
- **Threat**: Attacker guesses session IDs or takes over active phone calls.
- **Attack Surface**: `POST /api/ivr/session/:id/*`.
- **Existing Control**: Cryptographically generated non-sequential IDs (`TG-IVR-XXXXXXXX`, 8 alphanumeric chars from CSPRNG).
- **Hardening**: Strict 5-minute TTL; terminated calls cannot accept further inputs.
- **Test**: `phase10_ivr.test.cjs` / `phase11_security.test.cjs` (Test H1, H2).

### 18. IVR Replay Attacks
- **Threat**: Replaying past DTMF sequences to reproduce a `VERIFIED` state.
- **Attack Surface**: `POST /api/ivr/session/:id/input`.
- **Existing Control**: State machine transitions (`WELCOME` -> `AWAITING_OFFICER_CODE` -> `VERIFYING` -> `COMPLETED`).
- **Hardening**: Terminated or completed sessions strictly reject further DTMF processing.
- **Test**: `phase10_ivr.test.cjs` / `phase11_security.test.cjs` (Test H1).

### 19. Rate-Limit Abuse
- **Threat**: Denial of service via high-frequency API bombardment.
- **Attack Surface**: Entire `/api/` tree.
- **Existing Control**: Global Express rate limiter (100 req / 15 min).
- **Hardening**: Specialized tighter rate limits for verification challenge creation, citizen verification, and IVR gateways.
- **Test**: `phase11_security.test.cjs` (Test Category J).

### 20. API Parameter Abuse & Excessive Payloads
- **Threat**: Sending oversized JSON or malformed structures to crash server process.
- **Attack Surface**: All POST/PUT/PATCH endpoints.
- **Existing Control**: Body parser size limit; Zod schema input validation.
- **Hardening**: Clean 400 Bad Request error handlers for `entity.too.large` and invalid JSON; zero server crash.
- **Test**: `phase11_security.test.cjs` (Test C1, C2).

### 21. SQL Injection (SQLi)
- **Threat**: Attacker inputs SQL syntax into search, login, or ID parameters to manipulate database queries.
- **Attack Surface**: Database queries across controllers.
- **Existing Control**: Parameterized PostgreSQL queries using `$1, $2, ...` placeholders.
- **Hardening**: String concatenation prohibited in all SQL statements; in-memory pool mirrors parameterized queries.
- **Test**: `phase11_security.test.cjs` (Test D1, D2).

### 22. NoSQL-style / Prototype Pollution Injection
- **Threat**: Attacker injects `__proto__`, `constructor`, or `prototype` keys into request bodies to modify Object behavior.
- **Attack Surface**: JSON parsing across controllers.
- **Existing Control**: Zod strict object schemas strip unexpected properties.
- **Hardening**: Express JSON parser and Zod validation shield against prototype tampering.
- **Test**: `phase11_security.test.cjs` (Test C8).

### 23. Cross-Site Scripting (XSS)
- **Threat**: Injected script tags in report descriptions or officer names executing in admin browser context.
- **Attack Surface**: Report descriptions, officer fields, review notes.
- **Existing Control**: React JSX automatic escaping; HTML sanitization in frontend rendering.
- **Hardening**: Strict Content-Security-Policy headers via Helmet; zero usage of unescaped `dangerouslySetInnerHTML`.
- **Test**: `phase11_security.test.cjs` (Test D4).

### 24. Cross-Site Request Forgery (CSRF)
- **Threat**: Malicious websites triggering state-changing requests using citizen browser credentials.
- **Attack Surface**: State-changing API endpoints.
- **Existing Control**: Bearer JWT token architecture; tokens stored in memory/session and sent via explicit `Authorization: Bearer <token>` header (not automatically attached cookies).
- **Hardening**: CORS configured with explicit trusted origins; browsers do not send Bearer tokens on cross-site requests.
- **Test**: `phase11_security.test.cjs` (Test Category J).

### 25. Server-Side Request Forgery (SSRF)
- **Threat**: Providing internal network URLs in QR codes or report links for backend fetch.
- **Attack Surface**: Verification and evidence services.
- **Existing Control**: TrustGov does not fetch external URLs; all verification data is resolved against internal registry or blockchain.
- **Hardening**: External URI schemes rejected in QR resolvers.
- **Test**: `phase6_qr.test.cjs`.

### 26. Path Traversal Attacks
- **Threat**: Attacker uses `../`, `..\\`, or `%2e%2e` in evidence filenames to read arbitrary server files.
- **Attack Surface**: Evidence upload and download endpoints.
- **Existing Control**: Generated storage filenames use random hex (`crypto.randomBytes(16).toString('hex')`).
- **Hardening**: Explicit directory containment checks in `validateEvidenceFile` and `readEvidenceBuffer` (`resolvedPath.startsWith(STORAGE_DIR)`).
- **Test**: `phase11_security.test.cjs` (Test D3).

### 27. Malicious File Upload Attacks
- **Threat**: Uploading executable binaries, scripts (`.exe`, `.sh`, `.js`), or archives (`.zip`) as evidence.
- **Attack Surface**: `POST /api/citizen/reports/:id/evidence`.
- **Existing Control**: Strict whitelist of allowed extensions (`.jpg`, `.png`, `.pdf`, `.txt`, `.webp`) and MIME types.
- **Hardening**: Prohibited extension blacklist rejects `.exe`, `.bat`, `.ps1`, `.dll`, `.zip`, `.tar`, and double extensions.
- **Test**: `phase9_scam_reporting.test.cjs` / `phase11_security.test.cjs` (Test F1).

### 28. Malicious File Content / Decompression Bombs
- **Threat**: Uploading oversized files or decompression bombs to exhaust server memory.
- **Attack Surface**: `POST /api/citizen/reports/:id/evidence`.
- **Existing Control**: 10 MB strict file size limit enforced before disk write.
- **Hardening**: Stream and buffer size validations prevent memory exhaustion.
- **Test**: `phase9_scam_reporting.test.cjs` / `phase11_security.test.cjs` (Test F2).

### 29. Secret Leakage
- **Threat**: Database credentials, JWT secrets, or private keys exposed in API responses or logs.
- **Attack Surface**: Error handlers, console logs, git repository.
- **Existing Control**: Structured audit logging omits sensitive payload keys.
- **Hardening**: Gitignore rules for `.env` and `.keystore`; automated repository secret scan.
- **Test**: `phase11_security.test.cjs` (Test Category K).

### 30. Dependency Vulnerabilities
- **Threat**: Exploitable security flaws in third-party npm packages.
- **Attack Surface**: Node.js dependencies (`node_modules`).
- **Existing Control**: Pinned versions in `package-lock.json`.
- **Hardening**: `npm audit` run across backend and frontend codebases; zero critical production vulnerabilities.
- **Test**: Build & Audit pipeline.

### 31. Blockchain Configuration Mistakes
- **Threat**: Pointing backend to wrong contract address, unanchored test accounts, or missing network RPC.
- **Attack Surface**: Blockchain integration service.
- **Existing Control**: `blockchain_registry` database records map credential IDs to smart contract transaction hashes.
- **Hardening**: Environment validation checks `BLOCKCHAIN_RPC_URL` and `TRUSTGOV_REGISTRY_ADDRESS` on production boot.
- **Test**: `phase5_blockchain.test.cjs` / Hardhat suite.

### 32. Database Credential Exposure
- **Threat**: Raw connection strings or passwords leaked in server error messages or stack traces.
- **Attack Surface**: API error responses.
- **Existing Control**: Global Express error handler catches unhandled exceptions.
- **Hardening**: Error responses sanitized to return generic codes (`INTERNAL_SERVER_ERROR`) without leaking connection parameters.
- **Test**: `phase11_security.test.cjs` (Test J3).

### 33. Log Leakage
- **Threat**: Passwords, full credit card numbers, OTPs, or private keys printed to stdout/stderr.
- **Attack Surface**: Console and audit log streams.
- **Existing Control**: Audit logs capture metadata without sensitive credential fields.
- **Hardening**: Phone numbers tokenized (`TEL-XXXXXXXXXXXX`); passwords and JWT tokens omitted from audit logs.
- **Test**: `phase11_security.test.cjs` (Test Category K).

### 34. Environment Configuration Mistakes
- **Threat**: Booting production application with default test keys, missing secrets, or permissive CORS.
- **Attack Surface**: Server boot and configuration loading.
- **Existing Control**: `dotenv` loading.
- **Hardening**: `validateEnvironment()` startup guard aborts boot if `NODE_ENV === 'production'` and `JWT_SECRET` is insecure or unconfigured.
- **Test**: `phase11_security.test.cjs` (Test J5).

### 35. Denial-of-Service Attempts
- **Threat**: Crashing application via slow HTTP headers, infinite loops, or unhandled promise rejections.
- **Attack Surface**: Network listener on port 5000.
- **Existing Control**: Express request timeouts and unhandled rejection process handlers.
- **Hardening**: Multi-stage Docker container with non-root user and automated health checks (`GET /api/health`).
- **Test**: `phase11_security.test.cjs` (Test Category J).
