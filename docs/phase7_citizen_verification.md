# TrustGov Phase 7: Citizen Verification, Trust Experience, Verification History & Anti-Scam Protection

## 1. Executive Summary & Core Objective

The purpose of **Phase 7** is to transform TrustGov’s cryptographic and blockchain infrastructure into an accessible, understandable, secure, and user-friendly experience for ordinary citizens.

Phase 7 does **not** create a new verification engine or duplicate cryptography. Instead, it builds an anti-scam citizen trust portal around the existing Phase 1–6 infrastructure:
- **Decentralized Identifiers (DIDs)** (Phase 3)
- **W3C Verifiable Credentials & Ed25519 Authority Signatures** (Phase 4)
- **Ethereum Smart Contract Registry (`TrustGovRegistry.sol`)** (Phase 5)
- **RFC 8785 Proof-of-Possession & Replay Protection** (Phase 6)
- **QR Code Badges & Camera Scanner** (Phase 6)

---

## 2. Core Philosophy: The Zero False-Trust Invariant

> [!IMPORTANT]
> **Identity Verification ≠ Request Legitimacy**
> - In real-world scams (such as "digital arrest" extortion), scammers sometimes impersonate real officers, or real officers exceed their legal authority.
> - TrustGov clearly separates **Who someone is** from **What they are allowed to ask**.
> - Even if an officer is 100% cryptographically verified, demanding funds via personal UPI, asking for OTPs, requesting banking PINs, or ordering software installations triggers a **Critical Scam Warning** banner.

> [!IMPORTANT]
> **Current vs. Historical Verification Distinction**
> - A historical verification proves that an identity check succeeded at that specific moment in time.
> - Historical references (`TG-VFY-XXXXXXXX`) are distinctly stamped: *"Current officer status may have changed since this verification was recorded on [timestamp]."*
> - Citizens are provided a 1-click *"Verify Current Status"* action to run a fresh live check.

---

## 3. 3-Stage Citizen User Journey

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGE 1: IDENTIFY                               │
│  Citizen selects method:                                               │
│  [ 📷 Scan QR ]  |  [ Officer Code ]  |  [ Credential ID ]  |  [ DID ] │
│  - Seamless tab switching                                              │
│  - Graceful camera denial fallback to manual tabs                      │
│  - Pre-verification educational notice & claimed demand selection      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGE 2: VERIFY                                 │
│  Orchestrated by POST /api/citizen/verify:                             │
│  - Step 1: Resolve official government record                          │
│  - Step 2: Validate DID document & multibase public key                │
│  - Step 3: Validate W3C Verifiable Credential Ed25519 signature        │
│  - Step 4: Check active duty & good standing authorization             │
│  - Step 5: Check SHA-256 hash match on TrustGovRegistry smart contract │
│  - Step 6: Verify Ed25519 challenge-response proof (if provided)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGE 3: UNDERSTAND                             │
│  Citizen receives an unambiguous, non-technical verdict:               │
│  • VERIFIED: Green badge, officer details, 5 checks, anti-scam rules   │
│  • FAILED: Red badge, human-readable reason, protective action advice  │
│  • INCOMPLETE: Amber badge, network/service explanation (≠ verified)   │
│  • Actions: View Technical Details, Share Reference, Verify Again      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Multi-Method Identification & Camera Fallback

Citizens can verify an official using any of four options:
1. **[ 📷 Scan QR ]**: Reuses the Phase 6 `QRScannerModal` with video stream analysis, camera permission request, and QR scheme validation (`TRUSTGOV://verify/<credentialId>`).
2. **[ Officer Code ]**: Simple input for human-readable codes (e.g. `TG-OFF-001`).
3. **[ Credential ID ]**: Input for full W3C credential references (e.g. `VC-TG-TG-OFF-001-4D78E09B`).
4. **[ DID Identity ]**: Input for decentralized identifiers (e.g. `did:trustgov:550e8400-...`).

### Camera Permission Fallback
If the citizen denies camera access or the device has no camera:
- The modal closes without trapping the user.
- A prominent alert explains: *"Camera access was not granted. You can still verify the officer using their Officer Code, Credential ID, or DID."*
- 1-click buttons immediately activate the manual tabs.

---

## 5. Normalized Verification Result Model & 4 Explicit States

### Backend API: `POST /api/citizen/verify`
```json
{
  "verificationId": "TG-VFY-7K29XQ4P",
  "result": "VERIFIED",
  "method": "OFFICER_CODE",
  "timestamp": "2026-09-22T16:41:01.000Z",
  "officer": {
    "fullName": "Demo Officer Rajesh Kumar",
    "officerCode": "TG-OFF-001",
    "department": "Demo Central Investigation Bureau",
    "designation": "Superintendent of Police",
    "status": "ACTIVE"
  },
  "checks": {
    "identity": { "status": "VERIFIED", "did": "did:trustgov:550e8400-...", "didStatus": "ACTIVE" },
    "credential": { "status": "VERIFIED", "credentialId": "VC-TG-...", "signatureValid": true },
    "officerStatus": { "status": "ACTIVE", "active": true },
    "proofOfPossession": { "status": "VERIFIED" },
    "blockchain": { "status": "VERIFIED", "anchored": true }
  },
  "safety": {
    "isProhibitedDemand": false,
    "warning": "Identity verification confirms who this person is, but does NOT authorize them to demand confidential financial credentials or money transfers.",
    "rules": [
      "Never transfer money to personal UPI or bank accounts.",
      "Never disclose OTPs, banking PINs, or account passwords.",
      "Never install remote screen-sharing software."
    ]
  }
}
```

### The 4 Explicit Verification States:
1. **`VERIFYING`**: Honest progressive feedback displaying milestones (Resolving Identity ➔ Checking Signatures ➔ Checking Smart Contract Anchor). No fake delays.
2. **`VERIFIED`**: All required cryptographic, authorization, and ledger checks pass. Displays official officer profile, 5-point checklist, verification reference, and safety notices.
3. **`FAILED`**: Explicit rejection with human-readable reason (e.g. *"Officer credential has been revoked"*, *"Officer is suspended"*, *"Cryptographic signature mismatch"*).
4. **`INCOMPLETE`**: System could not reach a definitive conclusion due to temporary service or network conditions. **INCOMPLETE ≠ VERIFIED** and **INCOMPLETE ≠ FAILED**.

---

## 6. Citizen Verification History & Privacy Isolation

### Database Schema (`07_citizen_verification_history.sql`):
```sql
CREATE TABLE citizen_verification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id VARCHAR(255) UNIQUE NOT NULL,
    citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_method VARCHAR(50) NOT NULL,
    officer_reference VARCHAR(255),
    officer_name VARCHAR(255),
    department VARCHAR(255),
    credential_reference VARCHAR(255),
    result VARCHAR(50) NOT NULL,
    failure_reason TEXT,
    checks_summary JSONB,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Privacy & RBAC Invariant:
- Verification history records are strictly scoped to the authenticated citizen (`WHERE citizen_id = $1`).
- **Citizen A cannot view Citizen B’s history**: Attempting to query an ID belonging to another citizen returns **HTTP 404 (`RECORD_NOT_FOUND`)**.
- Unauthenticated citizens can still verify officers; history logging is activated when authenticated.

---

## 7. Safe Public Verification References (`TG-VFY-XXXXXXXX`)

Every verification attempt receives a safe, non-sequential reference generated with cryptographic randomness:
`TG-VFY-XXXXXXXX` (e.g., `TG-VFY-7K29XQ4P`).

### Public Lookup: `GET /api/verification/public/:reference`
- **Zero PII Exposure**: Does **NOT** expose citizen identity, user IDs, JWTs, private keys, or raw confidential claims.
- **Historical Labeling**: Distinctly marked with `isHistorical: true` and disclaimer:
  > *"This is a historical verification record. Officer credentials, suspension, or active duty status may have changed since this timestamp."*
- **Actionable**: Includes a 1-click *"Verify Current Status"* action to run a fresh verification.

### Sharing:
- Supports the native browser Web Share API (`navigator.share`) on mobile devices.
- Provides 1-click copy with sanitized non-PII text preview.

---

## 8. Anti-Scam Safety Center & Proactive Guardrails

TrustGov embeds dedicated anti-extortion protections:
1. **"Digital Arrest" Scam Education**: Explains how fraudsters stage fake video calls claiming illegal parcels or money laundering to extort money. Explains that real police never conduct trials over Skype or WhatsApp.
2. **Prohibited Demands (Zero Tolerance)**:
   - Personal UPI transfers or bank deposits ("clearance fees", "bail bonds")
   - Mobile OTP requests
   - ATM/Card PINs or net-banking passwords
   - Remote access apps (AnyDesk, TeamViewer)
3. **In-Context Scam Interception**:
   - If a citizen indicates that the officer is demanding money or codes, a bright red **CRITICAL FRAUD WARNING** banner is displayed immediately, regardless of identity validity.

---

## 9. Accessibility & Mobile-First UX

- **Accessible Terminology**: Uses plain citizen language (*"Verified"*, *"Digital Identity"*, *"Authority Signature"*, *"Smart Contract Ledger"*) rather than cryptographic jargon.
- **Color Independence**: Statuses are never conveyed by color alone; every indicator combines color with text and distinct icons (`✓ VERIFIED`, `✕ FAILED`, `⚠ INCOMPLETE`).
- **Mobile Optimized**:
  - Full-width touch targets (minimum 44px height).
  - Responsive tab grid.
  - Safe truncation with 1-click copy for long DID strings, hashes, and verification references.

---

## 10. IVR Integration Preparation (Channel-Independent Architecture)

Phase 7 intentionally designs `verifyOfficerHandler` as a channel-agnostic service:
```
           Web Citizen UI
                 \
             Mobile App
                  \
            Future IVR -----> Unified Verification Service (/api/citizen/verify)
                  /
             SMS Gateway
                 /
```
The verification logic does not reside in frontend components. Future IVR phone-call gateways can call the exact same endpoint with `method: "OFFICER_CODE"` or `method: "CREDENTIAL_ID"`.

---

## 11. Security Audit & Automated Test Results

### Phase 7 Test Suite (`backend/test/phase7_citizen_verification.test.cjs`):
- **22 / 22 Tests Passing (100%)**:
  1. Verification succeeds for valid Officer Code
  2. Verification succeeds for valid Credential ID
  3. Verification succeeds for valid DID
  4. Verification succeeds for valid TrustGov QR scheme
  5. Invalid officer code returns FAILED (HTTP 404)
  6. Unknown credential ID returns FAILED (HTTP 404)
  7. Unknown DID returns FAILED (HTTP 404)
  8. Revoked credential returns FAILED result
  9. Suspended credential returns FAILED result
  10. Suspended officer returns FAILED result
  11. Revoked officer returns FAILED result
  12. Proof-of-possession verification with valid Ed25519 signature
  13. Proof-of-possession verification with tampered signature rejected
  14. Replay attack protection (reusing consumed challenge returns 409)
  15. Verification history records created automatically for authenticated citizen
  16. Citizen can retrieve own verification details by ID
  17. Privacy Isolation: Citizen 2 cannot access Citizen 1’s verification record
  18. Public verification reference lookup succeeds (GET /api/verification/public/:ref)
  19. Privacy Guarantee: Public reference contains ZERO citizen PII or credentials
  20. Public reference is distinctly marked as historical with disclaimer
  21. Anti-Scam Guardrail: Prohibited demands trigger critical scam warning
  22. Security Audit: Zero private keys, seeds, or PEM blocks in any API response

---

## 12. Full System Regression Status (Phases 1–7)

| Phase | Test Suite | Tests Passed | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Phase 7** | **Citizen Verification & Trust Experience** | **22 / 22** | **100%** |
| **Phase 6** | **Proof-of-Possession & Challenge-Response** | **11 / 11** | **100%** |
| **Phase 6** | **QR Scanner & Resolution Workflow** | **7 / 7** | **100%** |
| **Phase 5** | **Blockchain Backend Anchoring & Verification** | **15 / 15** | **100%** |
| **Phase 5** | **Smart Contract Integrity (`TrustGovRegistry.sol`)** | **24 / 24** | **100%** |
| **Phase 4** | **Verifiable Credentials (W3C & Ed25519)** | **25 / 25** | **100%** |
| **Phase 3** | **DID & Cryptographic Identity** | **21 / 21** | **100%** |
| **Phase 2** | **Officer Management & Role Access Control** | **16 / 16** | **100%** |
| **Total** | **Full System Regression Suite** | **141 / 141** | **100%** |

### Build Status:
- Backend TypeScript compilation: **Clean (0 errors)**
- Frontend Vite production bundle: **Clean (0 errors, 447 kB bundle)**
