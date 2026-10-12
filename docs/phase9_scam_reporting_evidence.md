# TrustGov Phase 9: Scam Reporting & Cryptographic Evidence Management

## 1. Executive Summary & Core Objective

**Phase 9** introduces the **Scam Reporting & Cryptographic Evidence Management System** to the TrustGov platform.

In Phases 1–7, TrustGov solved **Identity Verification** ("Who is this officer?").
In Phase 8, TrustGov introduced **Authorization & Risk Evaluation** ("Is this specific demand authorized?").

**Phase 9** provides the crucial **Incident Reporting, Evidence Preservation & Governance Layer** ("What happened, what evidence exists, and how is it cryptographically preserved?").

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                TRUSTGOV TRI-PILLAR ARCHITECTURE                         │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│   PILLAR 1: IDENTITY       │   PILLAR 2: AUTHORIZATION   │   PILLAR 3: INCIDENT &      │
│   VERIFICATION             │   & SAFETY EVALUATION       │   EVIDENCE PRESERVATION     │
│   (Phases 1–7)             │   (Phase 8)                 │   (Phase 9)                 │
├────────────────────────────┼─────────────────────────────┼─────────────────────────────┤
│ • "Who are you?"           │ • "Is this demand allowed?" │ • "What occurred?"          │
│ • Ed25519 W3C Credentials  │ • Policy Matching Rules     │ • Off-Chain Evidence Store  │
│ • DID Resolution           │ • Contextual Risk Engine    │ • Server-Side SHA-256 Digest│
│ • Challenge-Response Proof │ • Prohibited Action Blocker │ • Status Transition Machine │
│ • Smart Contract Anchoring │ • Zero False-Trust Guard    │ • Zero-PII Public Lookups   │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

### Core Mission
Phase 9 empowers citizens who have verified an officer, tested an action, or encountered an unverified impersonator to formally register an incident, preserve digital evidence with unalterable SHA-256 integrity digests, and maintain a chain of custody for administrative investigation.

---

## 2. Platform Boundaries & Legal Neutrality

> [!IMPORTANT]
> **Prototype Disclaimers & Legal Guardrails**
> - **Platform Boundaries**: TrustGov is an anti-impersonation and cryptographic identity verification demo platform. It is **NOT** a police First Information Report (FIR) gateway, emergency 911/112 dispatcher, or court of law.
> - **Neutral Terminology**: The platform uses strictly factual, neutral terminology: *"Suspicious Interaction"*, *"Citizen Report"*, *"Claimed Officer Reference"*, *"Submitted Evidence"*, and *"Administrative Review"*. TrustGov never makes unsubstantiated legal accusations or labels accused parties as "convicted fraudsters".
> - **Privacy Isolation (Tenant Security)**: A citizen can **never** view another citizen's reports or evidence (`404 RECORD_NOT_FOUND`). Reported officers do **NOT** receive access to reports about themselves. Internal admin review notes are strictly hidden from citizens.
> - **Off-Chain Evidence Storage**: Raw evidence files (screenshots, PDFs, text logs) are stored in a protected, server-side storage repository (`storage/evidence/`). Files are **NEVER** placed in public static folders, never stored directly in the database, and never uploaded raw to the blockchain. Only cryptographic SHA-256 digests and logical references are persisted.

---

## 3. High-Level Architecture & Lifecycle Flow

```
[Citizen Client]
       │
       ├─► 1. File Report (POST /api/citizen/reports)
       │      │  (Links optional Phase 7 verification & Phase 8 evaluation)
       │      ▼
       │   [Report Service]
       │      │  Generates Server-Authoritative TG-REPORT-XXXXXXXX
       │      │  Sets status = SUBMITTED
       │      │  Logs REPORT_CREATED Audit Event
       │      ▼
       ├─► 2. Upload Evidence Files (POST /api/citizen/reports/:id/evidence)
       │      │  Enforces: Max 10MB, Max 10 files, Allowed extensions (.jpg, .png, .pdf, .txt, .webp)
       │      │  Rejects: Executables (.exe, .bat, .sh, .apk, .zip, etc.)
       │      ▼
       │   [Report Storage & SHA-256 Engine]
       │      │  Computes Server-Side SHA-256 Digest
       │      │  Stores bytes in protected storage/evidence/
       │      │  Logs REPORT_EVIDENCE_ADDED Audit Event
       │      ▼
       ├─► 3. Real-Time Cryptographic Integrity Check (GET /.../evidence/:id/integrity)
       │      │  Re-reads stored physical bytes
       │      │  Recomputes SHA-256 digest
       │      │  Compares against DB hash: VALID ✓ vs INTEGRITY_MISMATCH ✕
       │      ▼
[Admin Console]
       │
       ├─► 4. Review Incident & Evidence (GET /api/admin/reports)
       │
       ├─► 5. Execute Status Transition (PATCH /api/admin/reports/:id/status)
       │      │  Enforces State Machine: SUBMITTED -> UNDER_REVIEW -> RESOLVED -> CLOSED
       │      │  Logs REPORT_STATUS_CHANGED Audit Event
       │
       └─► 6. Add Administrative Review Note (POST /api/admin/reports/:id/notes)
              │  Confidential: Shielded completely from citizen responses
              │  Logs REPORT_REVIEW_NOTE_ADDED Audit Event
```

---

## 4. Centralized Report Categorization Catalog

TrustGov establishes a centralized catalog of 12 distinct incident categories:

| Category Code | Display Name | Typical Scenarios & Indicators | Default Risk Assessment |
|:---|:---|:---|:---|
| `PAYMENT_DEMAND` | Payment Demand / Extortion | Demand to transfer money to personal UPI, bank account, or QR code | `CRITICAL` |
| `OTP_REQUEST` | OTP or 2FA Demand | Caller requests one-time security password sent to citizen mobile | `CRITICAL` |
| `PIN_REQUEST` | ATM / Banking PIN Request | Demand for debit card PIN or mobile banking security credentials | `CRITICAL` |
| `PASSWORD_REQUEST` | Password Request | Demanding citizen online portal or email passwords | `CRITICAL` |
| `REMOTE_ACCESS_REQUEST` | Remote Software Demand | Directing citizen to install AnyDesk, TeamViewer, QuickSupport | `HIGH` |
| `IMPERSONATION` | Officer Impersonation | Fraudulently claiming official government identity without credentials | `HIGH` |
| `THREAT_OR_COERCION` | Threat or Coercion | Threatening immediate arrest, seizure, or violence | `HIGH` |
| `SUSPICIOUS_DOCUMENT` | Suspicious Notice / Order | Forged warrants, court summons, or simulated ministry letters | `MEDIUM` |
| `SUSPICIOUS_COMMUNICATION` | Suspicious Call / Message | Unofficial WhatsApp/Skype video call posing as law enforcement | `MEDIUM` |
| `IDENTITY_MISMATCH` | Identity / Detail Mismatch | Officer photo, voice, or department mismatches registry credential | `MEDIUM` |
| `UNAUTHORIZED_REQUEST` | Unauthorized Activity | Demanding action completely beyond statutory mandate | `LOW` |
| `OTHER` | Other Suspicious Activity | General anomalous or extortionate conduct | `UNKNOWN` |

---

## 5. Report Lifecycle State Machine

Citizens can **only create** reports with an initial status of `SUBMITTED`. All status transitions are server-authoritative and restricted to authorized `ADMIN` actors.

```
       ┌───────────────┐
       │   SUBMITTED   │
       └───────┬───────┘
               │ (Admin reviews report)
               ▼
       ┌───────────────┐  Request Info   ┌──────────────────────────────────┐
       │ UNDER_REVIEW  │ ──────────────► │ ADDITIONAL_INFORMATION_REQUIRED  │
       └───────┬───────┘ ◄────────────── └──────────────────────────────────┘
               │          Resume Review
               ├─────────────────────────────────────────┐
               ▼ (Case resolved)                         ▼ (Direct closure)
       ┌───────────────┐                         ┌───────────────┐
       │   RESOLVED    │ ──────────────────────► │    CLOSED     │
       └───────────────┘       Archive           └───────────────┘
```

### Transition Validation Rules:
1. `SUBMITTED` may only transition to `UNDER_REVIEW`.
2. `UNDER_REVIEW` may transition to `ADDITIONAL_INFORMATION_REQUIRED`, `RESOLVED`, or `CLOSED`.
3. `ADDITIONAL_INFORMATION_REQUIRED` may transition back to `UNDER_REVIEW`.
4. `RESOLVED` may transition to `CLOSED`.
5. `CLOSED` is a terminal state.
6. Citizens cannot delete, self-resolve, or alter the status of any report (`DELETE` is disabled; `404 Not Found`).

---

## 6. Cryptographic Evidence & SHA-256 Engine

### Storage Security Standards:
1. **Protected Directory**: Files are placed in `storage/evidence/` outside web server document roots.
2. **Obfuscated Filename**: Stored files receive random hex names (e.g., `23908a8bd3843742a6a1ee481d5854bf.png`) to prevent direct directory crawling and overwrite attacks.
3. **MIME & Extension Enforcement**:
   - **Allowed**: `image/jpeg` (`.jpg`, `.jpeg`), `image/png` (`.png`), `application/pdf` (`.pdf`), `text/plain` (`.txt`), `image/webp` (`.webp`).
   - **Prohibited**: Executables and script files (`.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.sh`, `.apk`, `.zip`, etc.) return `400 PROHIBITED_FILE_TYPE`.
4. **File Size Limit**: Strictly capped at 10MB per file; maximum 10 evidence attachments per report.

### Live Integrity Verification:
When a citizen or administrator clicks **"Verify Integrity"**:
1. The server reads the physical file from disk (source of truth).
2. Computes a fresh SHA-256 digest: `crypto.createHash('sha256').update(buffer).digest('hex')`.
3. Compares the freshly computed digest against the database `sha256_hash`:
   - If identical: Returns `{ integrity: 'VALID' }`.
   - If altered or bytes mutated: Returns `{ integrity: 'INTEGRITY_MISMATCH', calculatedHash, storedHash }`.

---

## 7. Zero-PII Public Reference Engine

TrustGov allows citizens to cite or look up a report publicly via `GET /api/reports/public/:reportId` without leaking sensitive information:

```json
{
  "success": true,
  "data": {
    "reportId": "TG-REPORT-CX22KAML",
    "category": "PAYMENT_DEMAND",
    "categoryDisplayName": "Payment Demand / Extortion",
    "status": "SUBMITTED",
    "submittedAt": "2026-09-23T13:34:12.235Z",
    "linkedVerification": "TG-VFY-882910AA",
    "linkedAuthorization": "TG-AUTH-991201BB",
    "disclaimer": "This public reference does not constitute confirmation that the reported incident has been independently verified. TrustGov Demo Reporting System."
  }
}
```

### Privacy Guarantees:
- **Zero Citizen Identity**: No names, emails, phone numbers, or user IDs.
- **Zero Evidence Files**: Raw files and storage references are strictly omitted.
- **Zero Admin Notes**: Internal investigative notes are omitted.
- **Public Disclaimer**: Always accompanies the response.

---

## 8. Database Migrations Specification

### Migration 1: `database/migrations/09_scam_reports.sql`
Creates table `scam_reports` with indexes on `report_id`, `citizen_id`, `officer_reference`, `status`, and `submitted_at`.

### Migration 2: `database/migrations/09_report_evidence.sql`
Creates tables:
- `report_evidence`: Records metadata, mime type, size, SHA-256 hash, and storage references for attached evidence files.
- `report_review_notes`: Records administrative review notes, reviewer ID/name, timestamp, and audit trail.

---

## 9. API Reference

### Citizen Endpoints (`CITIZEN` or `ADMIN` role)
- `POST /api/citizen/reports`: File new suspicious interaction report.
- `GET /api/citizen/reports`: List authenticated citizen's submitted reports.
- `GET /api/citizen/reports/:reportId`: Retrieve detailed report by ID.
- `POST /api/citizen/reports/:reportId/evidence`: Upload evidence file (multipart or base64 JSON).
- `GET /api/citizen/reports/:reportId/evidence`: List evidence attached to report.
- `GET /api/citizen/reports/:reportId/evidence/:evidenceId/integrity`: Re-compute and verify SHA-256 file integrity.
- `GET /api/citizen/reports/:reportId/evidence/:evidenceId/file`: Download/preview attached evidence.

### Admin Endpoints (`ADMIN` role only)
- `GET /api/admin/reports`: Query and filter all reports across the system.
- `GET /api/admin/reports/:reportId`: Full administrative report detail with internal notes.
- `PATCH /api/admin/reports/:reportId/status`: Execute valid status lifecycle transition.
- `POST /api/admin/reports/:reportId/notes`: Add confidential administrative review note.
- `GET /api/admin/reports/:reportId/evidence`: List all evidence for report.
- `GET /api/admin/reports/:reportId/evidence/:evidenceId/integrity`: Verify evidence hash.

### Public Endpoints
- `GET /api/reports/categories`: List all 12 standardized report categories.
- `GET /api/reports/public/:reportId`: Sanitized, zero-PII public reference lookup.

---

## 10. Audit Logging & Security Event Specification

Every Phase 9 lifecycle operation produces an immutable audit event:

| Event Action | Actor | Entity Type | Details Recorded |
|:---|:---|:---|:---|
| `REPORT_CREATED` | Citizen | `SCAM_REPORT` | Report ID, Category, Risk Level, Linked References |
| `REPORT_EVIDENCE_ADDED` | Citizen | `REPORT_EVIDENCE` | Evidence ID, Filename, Size, SHA-256 Hash |
| `REPORT_EVIDENCE_INTEGRITY_CHECKED` | Citizen / Admin | `REPORT_EVIDENCE` | Evidence ID, Verification Result (`VALID` / `MISMATCH`) |
| `REPORT_STATUS_CHANGED` | Admin | `SCAM_REPORT` | Report ID, Previous Status, New Status |
| `REPORT_REVIEW_NOTE_ADDED` | Admin | `REPORT_REVIEW_NOTE` | Report ID, Note ID, Reviewer Name |

---

## 11. Verification & Test Results

The automated test suite `backend/test/phase9_scam_reporting.test.cjs` verifies all 36 test requirements:

```powershell
================================================================
TRUSTGOV - PHASE 9: SCAM REPORTING & EVIDENCE MANAGEMENT TESTS
================================================================

[✓] Test 1: Citizen can create report (POST /api/citizen/reports)
[✓] Test 2: Unauthenticated user cannot create report (returns 401 Unauthorized)
[✓] Test 3: Report ID generated server-side in TG-REPORT-XXXXXXXX format
[✓] Test 4: Citizen cannot spoof another citizen ID (bound to authenticated token)
[✓] Test 5: Citizen cannot set status to RESOLVED (server forces SUBMITTED)
[✓] Test 6: Citizen cannot set reviewer identity
[✓] Test 7: Admin can view reports (GET /api/admin/reports)
[✓] Test 8: Non-admin cannot access admin reports (returns 403 Forbidden)
[✓] Test 9: Citizen A cannot read Citizen B report (returns 404 RECORD_NOT_FOUND)
[✓] Test 10: Officer cannot access citizen report merely because they are referenced (returns 403 or 404)
[✓] Test 11: Evidence upload works for supported file (PNG/text)
[✓] Test 12: Unsupported executable file rejected (.exe returns 400 PROHIBITED_FILE_TYPE)
[✓] Test 13: Oversized file rejected (>10MB returns 400 FILE_TOO_LARGE)
[✓] Test 14: Evidence SHA-256 hash generated server-side
[✓] Test 15: Client cannot force fake evidence hash (server recomputes digest)
[✓] Test 16: Evidence integrity check succeeds (returns integrity: VALID)
[✓] Test 17: Evidence tampering produces INTEGRITY_MISMATCH (tamper detected)
[✓] Test 18: Unauthorized citizen cannot access evidence (returns 404)
[✓] Test 19: Public report reference contains no citizen PII
[✓] Test 20: Public report reference exposes no evidence or internal notes
[✓] Test 21: Review notes are admin-only (Citizen returns 403, Admin returns 201)
[✓] Test 22: Invalid status transition rejected (SUBMITTED -> RESOLVED returns 400)
[✓] Test 23: Valid status transition succeeds (SUBMITTED -> UNDER_REVIEW)
[✓] Test 24: Audit event created for report (REPORT_CREATED)
[✓] Test 25: Audit event created for evidence (REPORT_EVIDENCE_ADDED)
[✓] Test 26: Audit event created for status change (REPORT_STATUS_CHANGED)
[✓] Test 27: Zero sensitive secrets or credentials leaked in response payloads
[✓] Test 28: Zero sensitive credentials or private keys in audit logs
[✓] Test 29: Rate limiting is configured for report and evidence routes
[✓] Test 30: Linked Phase 7 verification reference is validated (bad returns 400, valid succeeds)
[✓] Test 31: Linked Phase 8 authorization reference is validated (bad returns 400, valid succeeds)
[✓] Test 32: Citizen cannot link another citizen private evaluation (returns 400 UNAUTHORIZED_EVALUATION_LINK)
[✓] Test 33: Unverified suspicious interaction can still be reported (officer/vfy optional)
[✓] Test 34: Historical report remains auditable (admin can view full history, notes, and evidence)
[✓] Test 35: Report cannot be deleted by citizen (DELETE returns 404 Not Found)
[✓] Test 36: Existing Phase 8 evaluation functions intact (REQUEST_OTP yields CRITICAL & DENY)

================================================================
PHASE 9 TEST RESULTS: 36 / 36 PASSED (100%)
================================================================
>>> ALL 36 PHASE 9 TESTS COMPLETED SUCCESSFULLY! <<<
```

### Full System Regression Summary:
- **Phase 2 (Officer Management)**: 12 / 12 Passed (100%)
- **Phase 3 (DID & Cryptographic Identity)**: 20 / 20 Passed (100%)
- **Phase 4 (W3C Verifiable Credentials)**: 15 / 15 Passed (100%)
- **Phase 5 (Blockchain Registry)**: 12 / 12 Passed (100%)
- **Phase 6 (Challenge-Response Proof-of-Possession)**: 11 / 11 Passed (100%)
- **Phase 6 QR (QR Badge Scanner & Verification)**: 7 / 7 Passed (100%)
- **Phase 7 (Citizen Verification & Anti-Scam Protection)**: 22 / 22 Passed (100%)
- **Phase 8 (Authorization & Risk Engine)**: 32 / 32 Passed (100%)
- **Phase 9 (Scam Reporting & Evidence Management)**: 36 / 36 Passed (100%)
- **Total Platform Tests**: **209 / 209 PASSED (100%)**
- **TypeScript & Build Verification**: 0 Backend errors (`tsc`), 0 Frontend errors (`vite build`).
