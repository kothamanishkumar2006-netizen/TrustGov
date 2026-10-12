# TrustGov Phase 10: IVR Accessibility, Phone Verification & Voice Safety Gateway

## 1. Objective

Phase 10 provides an accessible, telephony-based voice verification gateway for TrustGov. Its primary mission is **digital inclusion**: enabling citizens without a smartphone, high-speed internet, web browser, or technical cryptographic knowledge to:
1. Initiate a TrustGov voice session using standard telephone keypad (DTMF) audio.
2. Enter an official Government Officer Code (`TG-OFF-XXX`).
3. Authoritatively verify officer identity against existing Phase 7 verification records.
4. Receive a voice-friendly, neutral identity result.
5. Check whether a claimed demand (e.g. UPI transfer, OTP request, document inspection) is authorized and safe under Phase 8 demo policies.
6. Receive clear voice safety warnings against prohibited demands.
7. Receive a short phonetic verification reference code (`TG-IVR-XXXXXXXX`).
8. Report suspicious or coercive interactions directly to Phase 9 scam reporting without fabricating evidence.
9. Enforce zero PII disclosure, telephone privacy, session locking, and anti-enumeration guardrails.

---

## 2. Architecture & ASCII System Diagram

The IVR Gateway is strictly an **access channel**. It consumes authoritative results from existing verification, authorization, and reporting engines; it does not duplicate business logic.

```
+-----------------------------------------------------------------------------------+
|                               CITIZEN ACCESS CHANNEL                              |
|                                                                                   |
|           +-----------------------+              +-----------------------+        |
|           | Standard Phone Call   |              | Web Browser / Admin   |        |
|           | (Keypad DTMF Audio)   |              | /admin/ivr-simulator  |        |
|           +-----------+-----------+              +-----------+-----------+        |
+-----------------------|--------------------------------------|--------------------+
                        |                                      |
                        v                                      v
+-----------------------------------------------------------------------------------+
|                        TRUSTGOV PHASE 10: IVR GATEWAY                             |
|                                                                                   |
|   +-----------------------+   +-----------------------+   +-------------------+   |
|   |   MockIvrProvider     |   |   IvrSecurity         |   | IvrPrompts        |   |
|   |  (Telephony Abstr.)   |   |  (TTL, Caps, Hash)    |   | (Voice Guidance)  |   |
|   +-----------+-----------+   +-----------+-----------+   +---------+---------+   |
|               |                           |                         |             |
|               +---------------------------+-------------------------+             |
|                                           |                                       |
|                                           v                                       |
|                        +-------------------------------------+                    |
|                        |    IvrService (State Machine)       |                    |
|                        |  - Session Lifecycle & Attempts     |                    |
|                        |  - DTMF Digit Dispatch              |                    |
|                        |  - Zero-Trust Input Normalization   |                    |
|                        +------------------+------------------+                    |
+-------------------------------------------|---------------------------------------+
                                            |
                  +-------------------------+-------------------------+
                  |                         |                         |
                  v                         v                         v
+-----------------------------+ +-----------------------+ +-----------------------+
|     PHASE 7 REUSE           | |     PHASE 8 REUSE     | |     PHASE 9 REUSE     |
| (ivrVerificationBridge.ts)  | | (authorizationEngine) | |    (reportService)    |
|                             | |                       | |                       |
| - Resolves Officer Code     | | - Evaluates Action    | | - Creates Scam Report |
| - Validates Ed25519 VC      | |   (e.g. REQUEST_UPI)  | | - Maps DTMF Category  |
| - Checks DID & Duty Status  | | - Generates Risk &    | | - Preserves Audit     |
| - Honest Proof-of-Possession| |   Decision (DENY)     | |   Correlation         |
|   (INCOMPLETE over Phone)   | | - Neutral Voice Safety| | - No Fake Evidence    |
+--------------+--------------+ +-----------+-----------+ +-----------+-----------+
               |                            |                         |
               +----------------------------+-------------------------+
                                            |
                                            v
+-----------------------------------------------------------------------------------+
|                           PERSISTENCE & AUDIT LAYERS                              |
|                                                                                   |
|  - ivr_sessions (Migration 10: State, Status, TTL, Attempts, Safe References)     |
|  - citizen_verification_history (Phase 7 audit & public verification reference)   |
|  - authorization_evaluations (Phase 8 policy evaluation log)                      |
|  - scam_reports (Phase 9 citizen incidents)                                       |
|  - audit_logs (Immutable audit events: IVR_SESSION_STARTED, IVR_LOCKED, etc.)     |
+-----------------------------------------------------------------------------------+
```

---

## 3. IVR Call Flow

```
CALL START (POST /api/ivr/call/start)
   |
   v
[WELCOME & MENU]
"Welcome to the TrustGov demonstration verification service.
 Press 1 to verify an officer.
 Press 2 to check a requested action.
 Press 3 to report a suspicious interaction.
 Press 9 to end."
   |
   +---> Press 1 ---> [COLLECT_OFFICER_CODE]
   |                    "Please enter the officer code followed by hash."
   |                    Caller enters: TG-OFF-001 (or 001)
   |                    Backend queries Phase 7 authoritative records.
   |                    --> Identity Verified: "The officer identity has been successfully verified."
   |                    --> Reference Spoken: "TEE GEE DASH VEE EFF WYE..."
   |                    --> Transition to [IDENTITY_RESULT]
   |
   +---> Press 2 ---> [COLLECT_ACTION] (Requires established officer context)
   |                    "Press 1 for UPI payment. Press 2 for OTP/PIN. Press 3 for remote access. Press 4 for document."
   |                    Caller enters: 1 (REQUEST_UPI_PAYMENT)
   |                    Backend queries Phase 8 authorization engine.
   |                    --> DENY + CRITICAL: "This request is not authorized by the TrustGov demonstration policy.
   |                                         Do not provide money, passwords, PINs, or OTPs."
   |                    --> Transition to [AUTHORIZATION_RESULT]
   |
   +---> Press 3 ---> [REPORT_MENU]
   |                    "Press 1 for payment demand. Press 2 for OTP/PIN. Press 3 for impersonation.
   |                     Press 4 for threat or coercion. Press 5 for another suspicious request."
   |                    Caller enters: 1 (PAYMENT_DEMAND)
   |                    Backend creates Phase 9 report with source = 'IVR'.
   |                    --> Report Reference Spoken: "TEE GEE DASH REPORT DASH..."
   |                    --> Transition to [REFERENCE]
   |
   +---> Press 9 ---> [END / HANGUP]
                        "Thank you for using the TrustGov demonstration verification service. Goodbye."
```

---

## 4. Session Lifecycle & State Machine

| State | Status | Trigger / Action | Next State |
| :--- | :--- | :--- | :--- |
| `WELCOME` / `MENU` | `ACTIVE` | Press 1 | `COLLECT_OFFICER_CODE` |
| `WELCOME` / `MENU` | `ACTIVE` | Press 2 (with officer context) | `COLLECT_ACTION` |
| `WELCOME` / `MENU` | `ACTIVE` | Press 2 (without officer context) | `COLLECT_OFFICER_CODE` |
| `WELCOME` / `MENU` | `ACTIVE` | Press 3 | `REPORT_MENU` |
| `COLLECT_OFFICER_CODE` | `ACTIVE` | Valid officer code (`TG-OFF-001`) | `IDENTITY_RESULT` |
| `COLLECT_OFFICER_CODE` | `ACTIVE` | Invalid code (< 5 attempts) | `COLLECT_OFFICER_CODE` (Retry) |
| `COLLECT_OFFICER_CODE` | `LOCKED` | Invalid code (>= 5 attempts) | Session Locked |
| `IDENTITY_RESULT` | `ACTIVE` | Press 2 | `COLLECT_ACTION` |
| `IDENTITY_RESULT` | `ACTIVE` | Press 3 | `REPORT_MENU` |
| `COLLECT_ACTION` | `ACTIVE` | Keypad 1-4 or action code | `AUTHORIZATION_RESULT` |
| `AUTHORIZATION_RESULT`| `ACTIVE` | Press 3 | `REPORT_MENU` |
| `REPORT_MENU` | `ACTIVE` | Category 1-5 | `REFERENCE` |
| Any State | Any | Expiration (TTL > 5 min) | `EXPIRED` |
| Any State | Any | Keypad 0 | Replay current state prompt |
| Any State | Any | Keypad 9 | `END` (`COMPLETED`) |

---

## 5. Security Model & Anti-Enumeration

1. **Server-Side Authoritative State**:
   - The caller payload cannot dictate `state`, `decision`, `riskLevel`, or `verificationResult`.
   - Any client-submitted override attempts are rejected.
2. **Anti-Enumeration Guardrails**:
   - The IVR never reveals whether a non-existent officer code exists in the database.
   - For any unverified or invalid officer code, the system responds identically:
     `"We could not verify that officer code."`
   - It **never** responds with `"Officer does not exist"`, preventing attackers from enumerating valid government personnel.
3. **Session Expiration & Attempt Caps**:
   - Session TTL: Strict 5 minutes (`300,000 ms`).
   - Maximum Officer Code attempts: 5. Exceeding locks the session (`LOCKED`).
   - Maximum Action attempts: 3.
   - Maximum Invalid menu attempts: 5.
4. **Replay & Completed Session Protection**:
   - Once a session transitions to `COMPLETED` or `EXPIRED`, all subsequent input is rejected.

---

## 6. Telephone Privacy Model (Zero PII)

1. **Caller Phone Number Protection**:
   - Incoming caller IDs are immediately tokenized into non-reversible, salted pseudonyms:
     `TEL-XXXXXXXXXXXX` via SHA-256.
   - Raw telephone numbers are **never stored** in the database, never emitted in audit logs, and never returned in public API payloads.
2. **Zero Cryptographic Secret Leakage**:
   - Private keys, seed phrases, Ed25519 PEM blocks, internal database IDs, and raw JWT tokens are strictly excluded from prompts and responses.
3. **Safe Reference Generation**:
   - Session Reference: `TG-IVR-XXXXXXXX`
   - Verification Reference: `TG-VFY-XXXXXXXX`
   - Authorization Reference: `TG-AUTH-XXXXXXXX`
   - Report Reference: `TG-REPORT-XXXXXXXX`
   - All references use non-sequential CSPRNG identifiers excluding ambiguous characters (`0`, `1`, `I`, `O`).

---

## 7. Phase 7 Identity Verification Integration & Proof-of-Possession Truthfulness

The IVR bridge (`ivrVerificationBridge.ts`) directly queries authoritative Phase 7 records:
- **Officer Database**: Verifies officer code and duty status (`ACTIVE`, `SUSPENDED`).
- **DID Registry**: Verifies Ed25519 DID status (`ACTIVE`).
- **Verifiable Credentials**: Evaluates W3C credential validity and digital signatures.
- **Blockchain Registry**: Confirms on-chain integrity anchor.

### Proof-of-Possession Truthfulness Guarantee
Standard telephone callers cannot prove possession of an officer's private signing key via basic DTMF audio. TrustGov **honestly reports this limitation**:
- The verification outcome is recorded with `proofOfPossession: 'NOT_PROVIDED'`.
- If active live possession is required, the IVR honestly states:
  > *"The officer identity record was found, but live possession verification could not be completed through this phone verification method. Please use the TrustGov web verification service for additional cryptographic verification."*
- The result is marked **`INCOMPLETE`**, not falsely elevated to `VERIFIED`.

---

## 8. Phase 8 Authorization & Risk Engine Integration

Keypad DTMF options map directly to Phase 8 Action Codes:
- `1` &rarr; `REQUEST_UPI_PAYMENT` (Evaluated as `DENY` + `CRITICAL`)
- `2` &rarr; `REQUEST_OTP` (Evaluated as `DENY` + `CRITICAL`)
- `3` &rarr; `REQUEST_REMOTE_ACCESS` (Evaluated as `DENY` + `HIGH`)
- `4` &rarr; `REQUEST_DOCUMENT` (Evaluated as `ALLOW` + `LOW`)

Voice Guidance Translation:
- **DENY + CRITICAL**:
  > *"This request is not authorized by the TrustGov demonstration policy. Do not provide money, passwords, PINs, or one-time passwords based only on this request. TrustGov and genuine law enforcement will never ask you to transfer funds to verify yourself."*
- **REVIEW**:
  > *"This request requires additional official written verification before proceeding. Do not take immediate action."*
- **ALLOW**:
  > *"This request is permitted under the current TrustGov demonstration policy. Continue to verify the context before taking action."*

---

## 9. Phase 9 Incident Reporting Integration

When suspicious activity occurs, callers press `3` to file a report directly:
- `1` &rarr; `PAYMENT_DEMAND`
- `2` &rarr; `OTP_REQUEST`
- `3` &rarr; `IMPERSONATION`
- `4` &rarr; `THREAT_OR_COERCION`
- `5` &rarr; `OTHER`

The system:
1. Calls `reportService.createReport()` with `source: 'IVR'`.
2. Automatically links `officerReference`, `verificationReference`, and `authorizationEvaluationReference`.
3. Honestly documents that no physical evidence files were uploaded over phone.
4. Generates a safe reference code `TG-REPORT-XXXXXXXX` and reads it phonetically over audio.

---

## 10. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/ivr/call/start` | Start a new IVR session |
| `POST` | `/api/ivr/session/:sessionId/input` | Submit DTMF or speech input |
| `POST` | `/api/ivr/session/:sessionId/repeat` | Replay prompt for current state |
| `POST` | `/api/ivr/session/:sessionId/end` | Terminate session immediately |
| `GET` | `/api/ivr/session/:sessionId/status` | Retrieve sanitized public session status |
| `POST` | `/api/ivr/simulator/reset` | Reset simulator state (Dev/Admin only) |
| `POST` | `/api/ivr/simulator/expire` | Force session expiration (Dev/Test only) |

---

## 11. Database Schema (`10_ivr_sessions.sql`)

```sql
CREATE TABLE IF NOT EXISTS ivr_sessions (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'WELCOME',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    caller_reference VARCHAR(64),
    officer_reference VARCHAR(128),
    verification_reference VARCHAR(64),
    authorization_reference VARCHAR(64),
    report_reference VARCHAR(64),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
```

---

## 12. Audit Events

| Audit Action | Entity Type | Trigger |
| :--- | :--- | :--- |
| `IVR_SESSION_STARTED` | `IVR_SESSION` | Call initialized |
| `IVR_OFFICER_CODE_SUBMITTED` | `IVR_SESSION` | Officer code entered |
| `IVR_VERIFICATION_COMPLETED` | `IVR_VERIFICATION` | Officer verified |
| `IVR_VERIFICATION_FAILED` | `IVR_VERIFICATION` | Officer lookup failed |
| `IVR_AUTHORIZATION_REQUESTED` | `IVR_SESSION` | Action check initiated |
| `IVR_AUTHORIZATION_COMPLETED` | `IVR_SESSION` | Policy evaluated |
| `IVR_REPORT_CREATED` | `IVR_REPORT` | Scam report filed |
| `IVR_SESSION_LOCKED` | `IVR_SESSION` | Attempts threshold exceeded |
| `IVR_SESSION_EXPIRED` | `IVR_SESSION` | TTL expired |
| `IVR_SESSION_COMPLETED` | `IVR_SESSION` | Call terminated |

---

## 13. Verification & Test Summary

- **Phase 10 Tests**: **42 / 42 passed (100%)**
- **Phase 1–9 Regression Tests**: **209 / 209 passed (100%)**
  - Phase 2 Officer Management: 16 / 16
  - Phase 3 DID Identity: 21 / 21
  - Phase 4 Verifiable Credentials: 25 / 25
  - Phase 5 Blockchain Registry: 15 / 15
  - Phase 6 Challenge-Response: 11 / 11
  - Phase 6 QR Resolution: 7 / 7
  - Phase 7 Citizen Verification: 22 / 22
  - Phase 8 Authorization & Risk Engine: 32 / 32
  - Phase 9 Scam Reporting & Evidence: 36 / 36
  - Blockchain Hardhat Smart Contract: 24 / 24
- **Total Workspace Tests**: **251 / 251 passed (100%)**
- **TypeScript Builds**:
  - Backend: **0 errors** (`tsc`)
  - Frontend: **0 errors** (`tsc && vite build`)

---

## 14. Known Limitations & Production Requirements

### Known Prototype Limitations
1. **Mock Telephony Provider**: Uses `MockIvrProvider` for local in-memory simulation. No live PSTN or carrier SIP trunk is connected.
2. **Proof-of-Possession**: Telephone DTMF cannot sign cryptographic challenges directly. Strict proofs require the officer's device or web verification.
3. **Single Locale Baseline**: Implemented in `en-IN`. Extensible interface prepared for `hi-IN` and `te-IN`.

### Future Production Telephony Requirements
1. **Carrier Webhook Signatures**: Validate HMAC SHA-256 signatures for incoming provider webhooks (e.g., Twilio/Exotel).
2. **Distributed Session Storage**: Redis backing for multi-instance horizontal scaling and distributed rate limiting.
3. **Hardware Security Module (HSM)**: Production key management for issuing authorities.
4. **Telecom Regulatory Compliance**: Adhere to regional telecom recording and CLI privacy regulations.
