# TrustGov Phase 8: Authorization & Risk Engine

## 1. Executive Summary & Core Objective

**Phase 8** implements the **Authorization & Risk Engine** for TrustGov, resolving the fundamental security question that follows identity verification:

> **"Even if this officer is 100% genuine and verified on the blockchain, is their specific requested action authorized and safe according to configured TrustGov demo policy?"**

While Phases 1–7 addressed **Identity Verification** ("Who are you?"), Phase 8 introduces **Authorization & Safety Evaluation** ("What are you demanding or ordering the citizen to do?").

Phase 8 creates a deterministic, explainable safety shield against modern cyber-extortion schemes—particularly **"digital arrest" scams** and unauthorized official demands—without compromising existing cryptographic verification or claiming sovereign governmental authority.

---

## 2. Core Philosophy: The Dual-Pillar Model

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            TRUSTGOV ARCHITECTURE                             │
├──────────────────────────────────────┬───────────────────────────────────────┤
│    PILLAR 1: IDENTITY VERIFICATION   │  PILLAR 2: AUTHORIZATION & SAFETY     │
│             (Phases 1–7)             │               (Phase 8)               │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ • "Who are you?"                     │ • "Is this requested action allowed?" │
│ • Resolves Decentralized ID (DID)    │ • Matches configured Demo Policies    │
│ • Validates Ed25519 W3C Credential   │ • Evaluates contextual constraints    │
│ • Confirms active duty status        │ • Flags strictly prohibited demands   │
│ • Checks smart contract registry     │ • Computes explainable risk level     │
│ • Verifies cryptographic proof       │ • Generates non-sensitive auth ref    │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

### The Zero False-Trust Invariant
Real-world extortion schemes frequently exploit official authority or pose as genuine police officers. Under TrustGov Phase 8:
- **Verified Identity does NOT grant blanket authorization**: Even if an officer possesses a valid DID, active W3C credential, and confirmed blockchain record, demanding prohibited actions (personal UPI transfers, banking OTPs, ATM PINs, passwords, or remote screen control) **deterministically yields `DENY` with a `CRITICAL SAFETY RISK` verdict**.
- **Backend Authoritative**: The server never trusts client-supplied assertions (`authorized`, `riskLevel`, `identityVerified`). All evaluations consume authoritative backend database states and cryptographic checks.
- **TrustGov Demo Disclaimer**: Evaluated against configured prototype demonstration policies; does not claim sovereign legal authority or supersede statutory law.

---

## 3. Centralized Action Catalog & Classifications

TrustGov establishes a centralized, standardized catalog of 15 actions across 8 operational categories:

| Action Code | Display Name | Category | Classification | Default Baseline |
|:---|:---|:---|:---|:---|
| `VERIFY_IDENTITY` | Verify Officer Identity | `IDENTITY` | `STANDARD` | Allowed for all active officers |
| `REQUEST_DOCUMENT` | Request Official Documents | `DOCUMENTATION` | `STANDARD` | Allowed via official channels |
| `REQUEST_SIGNED_DOCUMENT` | Request Signed Document | `DOCUMENTATION` | `STANDARD` | Allowed via official office |
| `REQUEST_PERSONAL_INFORMATION` | Request Personal Information | `INFORMATION` | `CONTROLLED` | Controlled inquiry; basic ID only |
| `REQUEST_PAYMENT` | Request Statutory Fee / Penalty | `PAYMENT` | `HIGH_RISK` | Only via official treasury portals |
| `REQUEST_UPI_PAYMENT` | Request Personal UPI Payment | `PAYMENT` | `PROHIBITED` | **Strictly Prohibited** (Critical Risk) |
| `REQUEST_BANK_TRANSFER` | Request Personal Bank Transfer | `PAYMENT` | `PROHIBITED` | **Strictly Prohibited** (Critical Risk) |
| `REQUEST_OTP` | Request One-Time Password | `CREDENTIAL_REQUEST` | `PROHIBITED` | **Strictly Prohibited** (Critical Risk) |
| `REQUEST_PIN` | Request Card / UPI PIN | `CREDENTIAL_REQUEST` | `PROHIBITED` | **Strictly Prohibited** (Critical Risk) |
| `REQUEST_PASSWORD` | Request Account Password | `CREDENTIAL_REQUEST` | `PROHIBITED` | **Strictly Prohibited** (Critical Risk) |
| `REQUEST_REMOTE_ACCESS` | Request Remote Desktop Access | `SYSTEM_ACCESS` | `PROHIBITED` | **Strictly Prohibited** (High Risk) |
| `REQUEST_SOFTWARE_INSTALLATION` | Request Software / APK Install | `SYSTEM_ACCESS` | `PROHIBITED` | **Strictly Prohibited** (High Risk) |
| `REQUEST_PHYSICAL_APPEARANCE` | Request Physical Appearance | `PROCEDURAL` | `CONTROLLED` | Review / Station appearance only |
| `ISSUE_OFFICIAL_NOTICE` | Issue Official Notice / Summons | `PROCEDURAL` | `STANDARD` | Official legal summons with ref |
| `OTHER` | Other Unlisted Action | `GENERAL` | `REVIEW_REQUIRED` | Default review requirement |

---

## 4. Policy Versioning & Non-Destructive Lifecycle

TrustGov implements immutable policy versioning to guarantee non-repudiation and auditability:

```
[Policy Code: TG-DEMO-DOCUMENT-001]
    ├── Version 1 (ACTIVE)      ───> Evaluated by Evaluation TG-AUTH-1001
    │                                (Permanently bound to Version 1)
    └── Version 2 (ACTIVE)      ───> Created on policy modification
        (v1 marked INACTIVE)         Evaluated by Evaluation TG-AUTH-1002
                                     (Historical TG-AUTH-1001 is NOT altered)
```

- **Compound Key**: Policies are identified by `(policy_code, version)` with UUID primary key.
- **Non-Destructive Updates**: Updating a policy archives the current active version (`INACTIVE`) and creates a new version increment (`version + 1`).
- **Historical Immutability**: Evaluations record the exact `policy_code` and `policy_version` active at the moment of evaluation. Historical evaluations can **never** be rewritten or retroactively altered when policies evolve.

---

## 5. Risk Engine, Guardrails & Explainable Reason Codes

### Risk Engine Evaluation Flow

```
                        [ Citizen / Client Request ]
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Step 1: Validate Action against Catalog  │
                └────────────────────┬─────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Step 2: Authoritative Identity Checks    │
                │  - Resolve Officer Code / DID / VC       │
                │  - Check Active Duty & Good Standing     │
                │  - Check W3C Cryptographic Signature     │
                │  - Check Blockchain Registry Match       │
                └────────────────────┬─────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Step 3: Hard Safety Guardrails Check     │
                │  - Prohibited Actions (OTP/PIN/Pass/UPI) │
                │  - Prohibited Contexts (Personal Bank)   │
                │  - Officer Suspended / Revoked Check     │
                └────────────────────┬─────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Step 4: Policy Match & Constraint Check  │
                │  - Match Department, Role & Action Code  │
                │  - Verify Channels, Data & Urgency Limits│
                └────────────────────┬─────────────────────┘
                                     │
                                     ▼
                ┌──────────────────────────────────────────┐
                │ Step 5: Risk Scoring & Verdict Decision  │
                │  - ALLOW / DENY / REVIEW                 │
                │  - LOW / MEDIUM / HIGH / CRITICAL        │
                │  - Attach Explainable Reason Codes       │
                │  - Generate Safe Ref TG-AUTH-XXXXXXXX    │
                └──────────────────────────────────────────┘
```

### Explainable Reason Codes Catalog
Every evaluation verdict is accompanied by structured, explainable reason codes containing clear citizen guidance:

- `AUTH_PROHIBITED_OTP`: Critical warning that officers never demand OTPs.
- `AUTH_PROHIBITED_PIN`: Critical warning that officers never demand card/UPI PINs.
- `AUTH_PROHIBITED_PASSWORD`: Critical warning that officers never demand passwords.
- `AUTH_PROHIBITED_PERSONAL_PAYMENT`: Critical warning that officers never demand transfers to personal UPI/bank accounts.
- `AUTH_PROHIBITED_REMOTE_ACCESS`: Warning that officers never require AnyDesk or screen-sharing tools.
- `AUTH_OFFICER_SUSPENDED` / `AUTH_OFFICER_REVOKED`: Rejection due to disciplinary suspension.
- `AUTH_DEMO_POLICY_ALLOW`: Transparent citation of matched demo permissive rule.
- `AUTH_NO_MATCHING_POLICY`: Baseline fallback requiring manual supervisor confirmation.

---

## 6. API Architecture & Endpoints

### 1. Admin Policy Management (`/api/admin/`)
*Requires `ADMIN` JWT role:*
- `GET /api/admin/authorization-policies`: List and filter policies by department, role, action, or status.
- `GET /api/admin/authorization-policies/:id`: Get detailed policy configuration and constraints.
- `POST /api/admin/authorization-policies`: Create a new demo policy (initializes version 1).
- `POST /api/admin/authorization-policies/:id/version` (or `PUT`): Non-destructively updates a policy, generating `version + 1`.
- `PATCH /api/admin/authorization-policies/:id/status`: Toggle policy lifecycle state (`ACTIVE` / `INACTIVE`).
- `GET /api/admin/authorization-actions`: Retrieve Centralized Action Catalog.
- `GET /api/admin/authorization-reason-codes`: Retrieve Centralized Reason Codes.

### 2. Citizen Action Evaluation (`/api/citizen/authorization/`)
*Optional auth for evaluate; `CITIZEN` or `ADMIN` for history:*
- `POST /api/citizen/authorization/evaluate`: Evaluates requested officer action against active policies and context.
- `GET /api/citizen/authorization/evaluations`: Retrieves logged-in citizen's past evaluation history.
- `GET /api/citizen/authorization/evaluations/:id`: Retrieves full details of a specific evaluation with privacy enforcement.

### 3. Officer Authorization Scope (`/api/officer/authorization/`)
*Requires `OFFICER` or `ADMIN` JWT role:*
- `GET /api/officer/authorization/scope`: Returns read-only catalog of actions permitted, review-required, and prohibited for the logged-in officer's department and designation under demo policies.

### 4. Public Evaluation Reference (`/api/verification/public/authorization/`)
*Unauthenticated public lookup:*
- `GET /api/verification/public/authorization/:reference`: Look up evaluation by reference (e.g. `TG-AUTH-XXXXXXXX`). Strictly sanitizes citizen PII, exposes zero tokens, and stamps the record as historical.

---

## 7. Database Schema & Migration

### Migration `08_authorization_policies.sql`
```sql
CREATE TABLE IF NOT EXISTS authorization_policies (
    id VARCHAR(64) PRIMARY KEY,
    policy_code VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    department VARCHAR(100) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'ALL',
    action_code VARCHAR(64) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_policy_code_version UNIQUE (policy_code, version)
);
```

### Migration `08_authorization_evaluations.sql`
```sql
CREATE TABLE IF NOT EXISTS authorization_evaluations (
    id VARCHAR(64) PRIMARY KEY,
    evaluation_id VARCHAR(32) UNIQUE NOT NULL,
    citizen_id VARCHAR(64),
    officer_reference VARCHAR(128) NOT NULL,
    officer_name VARCHAR(255),
    department VARCHAR(100),
    action_code VARCHAR(64) NOT NULL,
    policy_code VARCHAR(64),
    policy_version INTEGER,
    decision VARCHAR(32) NOT NULL,
    risk_level VARCHAR(32) NOT NULL,
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    checks_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
```

---

## 8. Frontend Experience & UI Components

1. **Citizen Protection Portal (`CitizenDashboard.tsx`)**:
   - **Interactive Action Checker**: Accordioned section within the verified officer card ("What is this officer asking you to do?").
   - **Pre-emptive Red Flag Detection**: Dynamically alerts users before submission if selecting prohibited demands (OTP, PIN, passwords, personal UPI, remote apps).
   - **3-Pillars Separation Card**: Clearly displays Identity Standing, Authorization Decision, and Safety Risk Level.
   - **Explainable Guidance**: Lists citizen-friendly action advice and policy citations.
   - **Dual-Tab History Viewer**: Toggles between Officer Verifications and Action Safety Evaluations.
   - **Historical Safety Detail Modal**: Safely displays historical action evaluations with non-PII references.

2. **Admin Policy Management (`AuthorizationPolicyManagement.tsx` & `OfficerManagement.tsx`)**:
   - Admin tab switcher between "Officers & Digital Credentials" and "Authorization Policies & Risk Engine".
   - Version-aware policy table showing active and archived versions.
   - Modal for authoring new policies and incrementing policy versions.
   - Live status toggle (`ACTIVE` / `INACTIVE`).
   - Centralized Action Catalog and Reason Code explorers.

3. **Officer Portal Scope Viewer (`OfficerDashboard.tsx`)**:
   - Read-only "Authorization Scope" section informing officers of their authorized actions and strictly prohibited boundaries under TrustGov demo rules.

---

## 9. Privacy, Security & Isolation Guarantees

- **Zero-Citizen PII in Public References**: Reference lookups return only officer reference, department, action code, decision, risk level, and historical timestamp.
- **Tenant Isolation**: Citizen A querying Citizen B’s private evaluation record via `/api/citizen/authorization/evaluations/:id` receives a strict `404 RECORD_NOT_FOUND`.
- **Zero Key Leakage**: No private keys, seed words, passwords, or authentication secrets appear in logs or API payloads.
- **Rate-Limiting**: Evaluation endpoints are protected under existing verification rate limiters.
- **Audit Logging**: All evaluation requests, policy creations, version increments, and status changes generate non-repudiable audit logs.

---

## 10. Test & Verification Results

All tests have been verified with 100% pass rates across all 8 phases of TrustGov:

```
===================================================================================
TRUSTGOV REGRESSION SUITE RESULTS (PHASES 1–8)
===================================================================================
Phase 1: Foundation & Authentication ........................... PASSED
Phase 2: Government Officer Management (16/16) ................ PASSED (100%)
Phase 3: DID & Cryptographic Identity (21/21) ................. PASSED (100%)
Phase 4: Verifiable Credentials & Ed25519 (25/25) ............. PASSED (100%)
Phase 5: Blockchain Smart Contract & Registry (15/15) ......... PASSED (100%)
Phase 5: Hardhat Ethereum Smart Contracts (24/24) ............. PASSED (100%)
Phase 6: Challenge-Response & Proof-of-Possession (11/11) ..... PASSED (100%)
Phase 6: QR Badge Resolution & Camera Scanner (7/7) ........... PASSED (100%)
Phase 7: Citizen Trust & Anti-Scam Verification (22/22) ....... PASSED (100%)
Phase 8: Authorization & Risk Engine Suite (32/32) ............ PASSED (100%)
===================================================================================
TOTAL INTEGRATION TESTS: 173 / 173 PASSED (100% PASS RATE)
BACKEND TYPESCRIPT BUILD: 0 ERRORS
FRONTEND VITE PRODUCTION BUILD: 0 ERRORS
===================================================================================
```
