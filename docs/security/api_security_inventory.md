# TrustGov API Security Inventory

## Overview
This inventory catalogs every REST endpoint in TrustGov across Phases 1 through 11, detailing its HTTP method, URL path, authentication requirement, RBAC role, rate limiting, input validation schema, data sensitivity, tenant isolation enforcement, audit logging event, and key security notes.

---

## Endpoint Inventory Matrix

| Method | Path | Auth | Role | Rate Limit | Input Validation | Sensitive Data | Tenant Isolation | Audit Event | Security Notes |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **GET** | `/api/health` | None | Public | Global | None | None | N/A | None | Safe service liveness check; zero secret leakage. |
| **GET** | `/api/ready` | None | Public | Global | None | None | N/A | None | Safe readiness probe for container orchestration. |
| **POST** | `/api/auth/register` | None | Public | Global | Zod (`registerSchema`) | Passwords hashed | N/A | `CITIZEN_REGISTRATION` | Password bcrypt hashed (10 rounds); email uniqueness enforced. |
| **POST** | `/api/auth/login` | None | Public | Global | Zod (`loginSchema`) | Password checked | N/A | `USER_LOGIN` / `FAILED_LOGIN_ATTEMPT` | Constant-time bcrypt comparison; fails securely without leaking user existence. |
| **GET** | `/api/auth/me` | Bearer | Any | Global | None | User profile | User-scoped | None | Returns authenticated user profile from database; validates active status. |
| **POST** | `/api/admin/officers` | Bearer | ADMIN | Global | Zod schema | Officer details | N/A | `OFFICER_CREATED` | Strictly restricted to ADMIN; officer code uniqueness enforced. |
| **GET** | `/api/admin/officers` | Bearer | ADMIN | Global | Query params | Officer directory | N/A | None | Admin officer directory with search, department, and status filters. |
| **GET** | `/api/admin/officers/:id` | Bearer | ADMIN | Global | UUID param | Full officer profile | N/A | None | Retrieves single officer record with audit metadata. |
| **PATCH** | `/api/admin/officers/:id/status` | Bearer | ADMIN | Global | Status enum | Status transition | N/A | `OFFICER_STATUS_UPDATED` | Governs ACTIVE, SUSPENDED, and REVOKED states. |
| **POST** | `/api/did/generate` | Bearer | ADMIN | Global | Officer ID | DID document | N/A | `DID_ISSUED` | Generates W3C compliant DID document; binds public key. |
| **GET** | `/api/did/:did` | None | Public | Global | DID regex | Public DID doc | N/A | None | Resolves public DID document; contains public key only, zero private keys. |
| **POST** | `/api/admin/officers/:id/credentials` | Bearer | ADMIN | Global | Validity days | Credential claims | N/A | `CREDENTIAL_ISSUED` | Signs W3C Verifiable Credential using issuer authority key; strict 1:1 active rule. |
| **GET** | `/api/admin/officers/:id/credentials` | Bearer | ADMIN | Global | Officer ID | Credential history | N/A | None | Lists historical credentials for an officer. |
| **PATCH** | `/api/admin/credentials/:id/status` | Bearer | ADMIN | Global | Status enum | Lifecycle status | N/A | `CREDENTIAL_STATUS_UPDATED` | Lifecycle transitions (ACTIVE, SUSPENDED, REVOKED). Permanent revocation enforced. |
| **GET** | `/api/credentials/:credentialId` | None | Public | Global | Credential ID | Public credential | N/A | None | Retrieves public credential JSON payload. |
| **GET** | `/api/credentials/:credentialId/verify` | None | Public | Global | Credential ID | Verification result | N/A | None | Public cryptographic verification of Ed25519 signature and blockchain anchor. |
| **POST** | `/api/credentials/verify` | None | Public | Global | Credential JSON | Verification result | N/A | None | Verifies raw credential payload directly against Issuer DID. |
| **POST** | `/api/admin/credentials/:id/blockchain-anchor` | Bearer | ADMIN | Global | Credential ID | Blockchain tx | N/A | `CREDENTIAL_BLOCKCHAIN_ANCHORED` | Submits SHA-256 hash to Smart Contract Registry on Sepolia/Hardhat. |
| **POST** | `/api/admin/officers/:id/blockchain-anchor-did` | Bearer | ADMIN | Global | Officer ID | Blockchain tx | N/A | `DID_BLOCKCHAIN_ANCHORED` | Anchors DID document hash to smart contract registry. |
| **GET** | `/api/blockchain/verify-credential/:id` | None | Public | Global | Credential ID | Anchor proof | N/A | None | Compares recomputed off-chain hash with on-chain anchored hash. |
| **POST** | `/api/verification/challenge` | None | Public | Targeted (60/5m) | Officer code/DID | Nonce & challenge | N/A | `CHALLENGE_CREATED` | Issues cryptographic challenge with 5-minute TTL; nonce generated via CSPRNG. |
| **POST** | `/api/verification/verify-proof` | None | Public | Targeted (60/5m) | Challenge signature | Verification verdict | N/A | `PROOF_VERIFIED` / `PROOF_FAILED` | Validates Ed25519 signature over challenge; marks challenge as USED. |
| **POST** | `/api/verification/qr-resolve` | None | Public | Targeted (60/5m) | QR URI string | Resolved metadata | N/A | `QR_VERIFICATION_STARTED` | Parses `TRUSTGOV://verify/<id>` URI; prevents SSRF/arbitrary URL redirects. |
| **POST** | `/api/officer/proof/sign` | Bearer | OFFICER | Global | Challenge ID | Signed challenge | Officer-scoped | `CHALLENGE_SIGNED` | Officer signs challenge using KeyProvider vault; prevents signing other officers' challenges. |
| **GET** | `/api/officer/proof/pending` | Bearer | OFFICER | Global | None | Pending challenges | Officer-scoped | None | Lists pending challenges specifically issued for the authenticated officer. |
| **POST** | `/api/admin/officers/:id/provision-key` | Bearer | ADMIN | Global | Officer ID | Public multibase | N/A | `KEY_PROVISIONED` | Admin provisions or rebinds an officer's signing key; private key kept in custody. |
| **GET** | `/api/officer/credentials` | Bearer | OFFICER | Global | None | Officer credentials | Officer-scoped | None | Displays credentials strictly belonging to the authenticated officer. |
| **POST** | `/api/citizen/verify` | Optional Bearer | Public/Citizen | Targeted (60/5m) | Target & method | Verification outcome | Citizen-scoped | `CITIZEN_VERIFICATION_STARTED` | Comprehensive verification orchestration (Officer + Credential + DID + Anchor). |
| **GET** | `/api/citizen/verifications` | Bearer | CITIZEN | Targeted (60/5m) | None | History records | Citizen-scoped | `VERIFICATION_HISTORY_VIEWED` | Lists verifications initiated by authenticated citizen. Strict tenant isolation. |
| **GET** | `/api/citizen/verifications/:id` | Bearer | CITIZEN | Targeted (60/5m) | Verification ID | Single history record | Citizen-scoped | None | Retrieves single verification record; returns 404 for records of other citizens. |
| **GET** | `/api/verification/public/:reference` | None | Public | Global | Reference code | Safe audit proof | Zero PII | None | Resolves `TG-VFY-XXXXXXXX` without revealing citizen phone, email, or internal IDs. |
| **POST** | `/api/citizen/authorization/evaluate` | Optional Bearer | Public/Citizen | Targeted (60/5m) | Action & Officer code | Safety decision | Citizen-scoped | `AUTHORIZATION_EVALUATED` | Evaluates action safety; ignores client-provided decision/riskLevel claims. |
| **GET** | `/api/citizen/authorization/evaluations` | Bearer | CITIZEN | Targeted (60/5m) | None | Evaluation history | Citizen-scoped | None | Lists evaluations requested by citizen; isolated by `citizen_id`. |
| **GET** | `/api/citizen/authorization/evaluations/:id` | Bearer | CITIZEN | Targeted (60/5m) | Evaluation ID | Evaluation record | Citizen-scoped | None | Details for single evaluation; returns 404 if owned by another user. |
| **GET** | `/api/authorization/public/:reference` | None | Public | Global | Reference code | Safe audit proof | Zero PII | None | Resolves `TG-AUTH-XXXXXXXX` reference code safely. |
| **GET** | `/api/admin/authorization-policies` | Bearer | ADMIN | Global | Query filters | Policy catalog | N/A | None | Admin view of all department authorization policies. |
| **POST** | `/api/admin/authorization-policies` | Bearer | ADMIN | Global | Policy schema | Created policy | N/A | `POLICY_CREATED` | Creates or updates authorization policy rules. |
| **GET** | `/api/reports/categories` | None | Public | Global | None | Category list | None | None | Returns official scam reporting categories. |
| **GET** | `/api/reports/public/:reportId` | None | Public | Global | Report reference | Public summary | Zero PII | None | Resolves `TG-REPORT-XXXXXXXX` reference; omits citizen identity, phone, review notes. |
| **POST** | `/api/citizen/reports` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | Report schema | Report metadata | Citizen-scoped | `REPORT_CREATED` | Creates suspicious interaction report. Sanitizes text inputs. |
| **GET** | `/api/citizen/reports` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | None | Citizen reports | Citizen-scoped | None | Lists reports filed by the authenticated citizen. |
| **GET** | `/api/citizen/reports/:reportId` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | Report ID | Report & evidence | Citizen-scoped | None | Retrieves report details; strips confidential admin review notes. |
| **POST** | `/api/citizen/reports/:reportId/evidence` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | File buffer & metadata | Evidence hash | Citizen-scoped | `REPORT_EVIDENCE_ADDED` | Validates MIME/extension, enforces 10MB limit, computes SHA-256 server-side. |
| **GET** | `/api/citizen/reports/:reportId/evidence/:evidenceId/integrity` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | Evidence ID | Integrity status | Citizen-scoped | `REPORT_EVIDENCE_INTEGRITY_CHECKED` | Live recalculation of stored file bytes vs database SHA-256 hash. |
| **GET** | `/api/citizen/reports/:reportId/evidence/:evidenceId/file` | Bearer | CITIZEN/ADMIN | Targeted (60/5m) | Evidence ID | File binary | Citizen-scoped | `REPORT_EVIDENCE_ACCESSED` | Serves evidence file; verifies ownership before reading; prevents path traversal. |
| **GET** | `/api/admin/reports` | Bearer | ADMIN | Global | Filters | All reports | N/A | None | Admin view of all citizen scam reports with risk and status filters. |
| **GET** | `/api/admin/reports/:reportId` | Bearer | ADMIN | Global | Report ID | Report with notes | N/A | None | Admin full report view including confidential review notes. |
| **PATCH** | `/api/admin/reports/:reportId/status` | Bearer | ADMIN | Global | Status enum | Updated status | N/A | `REPORT_STATUS_UPDATED` | Status transitions (SUBMITTED -> UNDER_REVIEW -> RESOLVED -> DISMISSED). |
| **POST** | `/api/admin/reports/:reportId/notes` | Bearer | ADMIN | Global | Note text | Created note | N/A | `REPORT_NOTE_ADDED` | Adds confidential investigator note; hidden from citizen API. |
| **GET** | `/api/admin/security-metrics` | Bearer | ADMIN | Global | None | Aggregated counts | N/A | None | Phase 11 safe security metrics monitoring endpoint. Zero secret exposure. |
| **POST** | `/api/ivr/call/start` | None | Public | IVR (30/15m) | Optional caller phone | Session reference | Phone tokenized | `IVR_SESSION_STARTED` | Creates non-sequential `TG-IVR-XXXXXXXX` session; phone hashed to `TEL-XXXX`. |
| **POST** | `/api/ivr/session/:sessionId/input` | None | Public | IVR (120/5m) | DTMF digits | Voice prompt | State-tracked | `IVR_INPUT_PROCESSED` | Processes keypad input through state machine; enforces max attempt caps. |
| **POST** | `/api/ivr/session/:sessionId/repeat` | None | Public | IVR (120/5m) | None | Voice prompt | State-tracked | None | Repeats active menu prompt. |
| **POST** | `/api/ivr/session/:sessionId/end` | None | Public | Global | None | Final prompt | State-tracked | `IVR_SESSION_COMPLETED` | Terminates IVR call cleanly; marks session COMPLETED. |
| **GET** | `/api/ivr/session/:sessionId/status` | None | Public | Global | Session ID | Safe status | Zero PII | None | Telephony diagnostic status; omits raw phone numbers and secrets. |
