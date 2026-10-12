# TrustGov Privacy Review & Data Minimization Assessment

## 1. Executive Summary
Privacy by design is a foundational requirement of the TrustGov architecture. As a system designed to verify officials and document suspicious encounters, TrustGov must collect sufficient data to facilitate authentic verification and crime reporting while actively minimizing citizen exposure, preventing correlation attacks, and safeguarding whistleblowers and victims.

This review contrasts prototype behaviors with production privacy requirements and evaluates data flows across all 11 phases.

---

## 2. Core Privacy Principles

### 2.1 Data Minimization
TrustGov restricts stored data strictly to fields required for authentication, cryptographic integrity, and incident triage.
- **Citizen Accounts**: Name, email, and phone number are collected for account recovery. No national identification numbers (e.g., Aadhaar, SSN, PAN) are requested or persisted in the prototype.
- **Verification Operations**: A citizen can verify an officer anonymously without logging in. The system records verification attempts with an optional `citizen_id` if authenticated; unauthenticated citizens generate zero persistent user links.
- **Evidence Storage**: Citizens submit evidence files directly. Filenames are stripped of original metadata and assigned randomized hex identifiers on disk to prevent filesystem leakage.

### 2.2 Ephemeral Tokenization of Telephony Identifiers
- Over the IVR gateway, citizens call from personal telephone numbers.
- Rather than storing raw telephone numbers in `ivr_sessions`, the application passes caller caller-ID through an ephemeral one-way salt hash:
  `tokenizeCallerPhone(phone) = "TEL-" + SHA256("TRUSTGOV_PHONE_SALT_" + normalizedPhone).slice(0, 12).toUpperCase()`
- This creates a pseudonymized identifier allowing session recovery during active calls without persisting identifiable phone numbers in database tables or logs.

### 2.3 Non-PII Public References
TrustGov issues four categories of public reference codes for transparency, auditing, and multi-channel handoff:
1. `TG-VFY-XXXXXXXX`: Verification reference
2. `TG-AUTH-XXXXXXXX`: Action authorization reference
3. `TG-REPORT-XXXXXXXX`: Public scam report reference
4. `TG-IVR-XXXXXXXX`: Telephony session identifier

**Privacy Guarantee**:
- All reference codes are generated using cryptographically secure random bytes (excluding visually ambiguous characters like `0`, `1`, `I`, `O`).
- None of these public references encode citizen IDs, database primary keys, telephone numbers, emails, JWT tokens, or internal filesystem paths.
- Querying a public reference endpoint returns strictly aggregated outcome summaries (e.g., "Verification: VERIFIED on 2026-09-23") and zero personal information regarding who conducted the verification.

### 2.4 Confidential Investigation Notes Isolation
- When admins or investigators review citizen scam reports, they record internal case notes (`adminAddReviewNote`).
- These review notes may contain sensitive law enforcement hypotheses, suspect surveillance notes, or case numbers.
- The citizen endpoint (`GET /api/citizen/reports/:reportId`) explicitly omits review notes from its response payload. Citizen victims can track the overall report status (`SUBMITTED`, `UNDER_REVIEW`, `RESOLVED`) without exposing sensitive internal notes.

---

## 3. Data Flow & Sensitivity Matrix

| Data Category | Purpose | Sensitivity | Masking / Protection | Prototype vs Production Differences |
|:---|:---|:---|:---|:---|
| **Citizen Passwords** | Authentication | Critical | Bcrypt (10 rounds) | Production requires multi-factor authentication (MFA / WebAuthn). |
| **Citizen Phone Numbers** | Citizen contact | High | Plaintext in DB; masked in logs | Production requires field-level AES-256 envelope encryption. |
| **Caller Telephony Number** | IVR session tracking | High | Salted SHA-256 token (`TEL-XXXX`) | Production requires rotating daily cryptographic salt. |
| **Officer Private Keys** | Ed25519 signing | Critical | Never stored in DB; `.keystore` vault | Production requires Hardware Security Module (HSM) or Cloud KMS. |
| **Evidence Files** | Scam investigation | High | SHA-256 digest; isolated storage | Production requires antivirus/malware sandboxing before storage. |
| **Audit Logs** | Security monitoring | Medium | Sanitized JSON metadata; zero secrets | Production requires write-once-read-many (WORM) audit storage. |

---

## 4. Production Privacy Requirements
1. **Right to Erasure (GDPR / DPDP Compliance)**:
   - Provide automated endpoints for citizens to request deletion of their profile, personal verification history, and non-active reports.
   - Preserved evidence linked to active criminal investigations must be legally exempted and archived under formal evidentiary rules.
2. **Field-Level Encryption**:
   - Sensitive columns in PostgreSQL (`users.phone`, `users.email`, `scam_reports.description`) should use pgcrypto or KMS envelope encryption at rest.
3. **Audit Log Masking**:
   - Automated log scrubbers to detect and mask accidental email or IP address entries in third-party monitoring platforms.
