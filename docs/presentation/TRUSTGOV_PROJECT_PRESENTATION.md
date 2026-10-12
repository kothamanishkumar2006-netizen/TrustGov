---
marp: true
theme: default
paginate: true
header: "TrustGov — Cryptographic Identity & Anti-Scam Platform"
footer: "Technical Review & Project Handover | Confidential"
style: |
  section {
    background-color: #0f172a;
    color: #f8fafc;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    padding: 40px 60px;
  }
  h1 {
    color: #38bdf8;
    font-size: 2.2rem;
    margin-bottom: 0.5rem;
  }
  h2 {
    color: #60a5fa;
    font-size: 1.6rem;
    border-bottom: 2px solid #334155;
    padding-bottom: 8px;
  }
  h3 {
    color: #93c5fd;
    font-size: 1.2rem;
  }
  p, li {
    font-size: 1.05rem;
    line-height: 1.5;
    color: #cbd5e1;
  }
  strong {
    color: #f1f5f9;
  }
  code {
    background-color: #1e293b;
    color: #38bdf8;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: Consolas, monospace;
    font-size: 0.95em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    margin-top: 15px;
  }
  th {
    background-color: #1e293b;
    color: #38bdf8;
    padding: 10px;
    text-align: left;
    border: 1px solid #334155;
  }
  td {
    padding: 10px;
    border: 1px solid #334155;
    color: #cbd5e1;
  }
  .highlight-red {
    color: #f87171;
    font-weight: bold;
  }
  .highlight-green {
    color: #4ade80;
    font-weight: bold;
  }
  .highlight-blue {
    color: #38bdf8;
    font-weight: bold;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .card {
    background-color: #1e293b;
    padding: 16px 20px;
    border-radius: 8px;
    border-left: 4px solid #38bdf8;
  }
  .card-danger {
    background-color: #1e293b;
    padding: 16px 20px;
    border-radius: 8px;
    border-left: 4px solid #ef4444;
  }
---

# TrustGov
### Blockchain-Supported Government Officer Identity Verification & Anti-Scam Platform

**System Evaluation, Technical Review & Handover**

- **Architecture:** Zero-Trust Cryptographic Verification with Immutable Audit Anchoring
- **Stack:** Node.js, Express, TypeScript, React, PostgreSQL Schema, Solidity, Hardhat EVM
- **Verification Status:** 387 / 387 Automated Tests Passing (100% Suite Pass Rate)
- **Deployment Status:** Local Prototype Verified; Cloud Architecture Staging-Ready

---

## Slide 1: Problem Statement — The Impersonation Epidemic

### The Digital Threat Landscape
- **Digital-Arrest Extortion Scams:** Criminal syndicates create forged digital police stations, show fabricated badges via video calls, and place victims under psychological coercion ("virtual arrest").
- **Financial Exploitation:** Victims are coerced into making urgent UPI transfers, bank RTGS transfers, or disclosing OTPs to "clear their name" from fake money-laundering or narcotics cases.
- **Root Vulnerability:** Citizens have **no zero-trust mechanism** to distinguish a genuine officer from a forged caller ID, counterfeit ID card, or video-call impersonator in real time.

<div class="grid-2">
  <div class="card-danger">
    <strong class="highlight-red">Current Citizen Vulnerability</strong>
    <ul>
      <li>Trusts visual badges easily forged in editing software</li>
      <li>Cannot verify caller authorization over phone</li>
      <li>Unaware that genuine police never demand UPI payments</li>
    </ul>
  </div>
  <div class="card">
    <strong class="highlight-blue">TrustGov Core Mandate</strong>
    <ul>
      <li>Replace blind trust with cryptographic proof</li>
      <li>Enforce strict server-side policy hard-denials</li>
      <li>Provide universal accessibility (Web & Voice IVR)</li>
    </ul>
  </div>
</div>

---

## Slide 2: Proposed Solution & Target Beneficiaries

### Multi-Tiered Zero-Trust Protection
TrustGov does not simply check a database; it establishes an end-to-end cryptographic trust chain that validates identity, evaluates operational authority, and preserves incident evidence.

<div class="grid-2">
  <div class="card">
    <strong class="highlight-blue">Key Architectural Pillars</strong>
    <ol>
      <li><strong>Decentralized Identifiers (W3C DID):</strong> Officer identity bound to public-key pairs.</li>
      <li><strong>W3C Verifiable Credentials:</strong> Tamper-evident credentials signed via Ed25519.</li>
      <li><strong>Blockchain Anchoring:</strong> Immutable lifecycle state on EVM registry.</li>
      <li><strong>Authoritative Risk Engine:</strong> Real-time safety evaluation for demanded actions.</li>
      <li><strong>Tamper-Resistant Scam Vault:</strong> SHA-256 evidence chain of custody.</li>
      <li><strong>Telephony Voice Gateway:</strong> Accessible IVR for non-smartphone citizens.</li>
    </ol>
  </div>
  <div class="card">
    <strong class="highlight-green">Target User Beneficiaries</strong>
    <ul>
      <li><strong>Citizens:</strong> Immediate multi-channel badge verification and scam prevention shield.</li>
      <li><strong>Law Enforcement Agencies:</strong> Elimination of departmental identity impersonation.</li>
      <li><strong>Anti-Fraud Investigators:</strong> Cryptographically timestamped incident reports and evidence.</li>
      <li><strong>Rural / Senior Citizens:</strong> Toll-free IVR voice verification without internet dependency.</li>
    </ul>
  </div>
</div>

---

## Slide 3: System Architecture & Technology Stack

### Layered Zero-Trust Architecture
```
[ Citizen Web App (React) ]         [ In-Browser DTMF Telephony (IVR) ]
            │                                         │
            └───────────────┬─────────────────────────┘
                            ▼
             [ TrustGov API Gateway (Express / TS) ]
      ┌─────────────────────┼─────────────────────┐
      ▼                     ▼                     ▼
[ Identity Service ]  [ Risk Policy Engine ] [ Evidence Vault ]
 (Ed25519 & DID)       (Authoritative Server) (SHA-256 Digest)
      │                     │                     │
      └─────────────────────┼─────────────────────┘
                            ▼
      ┌───────────────────────────────────────────┐
      │  Data Layer & Distributed Ledger          │
      │  ├─ PostgreSQL Engine (w/ In-Memory Seed) │
      │  └─ Hardhat EVM Smart Contract Registry   │
      └───────────────────────────────────────────┘
```

- **Frontend:** React 18, Vite, TypeScript, Tailwind/Vanilla CSS, Lucide Icons
- **Backend:** Node.js v22, Express, TypeScript, Helmet, Rate Limiter
- **Data & Ledger:** PostgreSQL Schema / Deterministic In-Memory Engine, Solidity 0.8.20 Smart Contract
- **Cryptography:** Ed25519 digital signatures, W3C DID, SHA-256 digests, CSPRNG challenge nonces

---

## Slide 4: Cryptographic Foundation — DID & Verifiable Credentials

### Self-Sovereign Identity Architecture
TrustGov implements the W3C Decentralized Identifier and Verifiable Credential standards:

1. **Decentralized Identifiers (DID):**
   - Format: `did:trustgov:<uuid>`
   - Public keys published in multibase Ed25519 format (`z6M...`).
   - Private keys are **never** stored in database tables or returned in API responses.

2. **W3C Verifiable Credentials:**
   - Cryptographic payload containing officer attributes, badge number, and authorized agency.
   - Signed using pure **Ed25519 digital signatures** by the TrustGov Issuance Authority.
   - Tamper-proof: Changing even 1 character in the credential invalidates the cryptographic proof.

3. **Proof-of-Possession & Replay Defense:**
   - Real-time verification uses dynamic **32-byte CSPRNG nonces** with a 5-minute TTL.
   - Single-use challenge state machine: Replaying a captured response returns `HTTP 409 Conflict`.

---

## Slide 5: Blockchain Integrity Anchoring & Immutability

### Smart Contract Registry (`TrustGovRegistry.sol`)
TrustGov anchors credential hashes and lifecycle states on an Ethereum-compatible registry contract:

```solidity
struct CredentialRecord {
    bytes32 credentialHash; // SHA-256 digest of credential payload
    string officerCode;     // Fictional identifier (e.g. TG-OFF-001)
    CredentialStatus status;// ACTIVE (0), SUSPENDED (1), REVOKED (2)
    uint256 registeredAt;   // Immutable timestamp
    uint256 updatedAt;      // Last state change
}
```

### Critical Security Properties
- **Tamper Evidence:** Modifying an off-chain database record creates an immediate hash mismatch against the on-chain digest.
- **Enforced Lifecycle State Machine:**
  - `ACTIVE` $\leftrightarrow$ `SUSPENDED` allowed for administrative duty changes.
  - `ACTIVE` $\rightarrow$ `REVOKED` or `SUSPENDED` $\rightarrow$ `REVOKED` allowed.
  - **Permanent Revocation:** Strict prohibition of `REVOKED` $\rightarrow$ `ACTIVE` (`CredentialPermanentlyRevoked`).
- **Audit Immutability:** No rogue administrator or attacker with DB access can reactivate a disgraced officer.

---

## Slide 6: Paradigm Shift — Identity vs. Action Authorization

### Crucial Security Insight: Authenticity $\neq$ Authority
A common vulnerability in digital systems is assuming that verifying who someone is authorizes what they are asking. **TrustGov decouples identity verification from action authorization.**

| Dimension | Verification Module | Authorization & Risk Engine |
| :--- | :--- | :--- |
| **Question Answered** | *"Is this individual a genuine officer?"* | *"Is this specific demand lawful and safe?"* |
| **Output** | Officer Profile, Badge, Credential Status | Authoritative `ALLOW`, `REVIEW`, or `DENY` |
| **Risk Context** | Cryptographic identity check | Action type, threat indicators, policy rule |

### Mandatory Server-Side Hard Denials
Even if an officer holds a 100% verified active credential, the engine hard-denies dangerous requests:
- `REQUEST_UPI_PAYMENT` $\rightarrow$ <span class="highlight-red">DENY (CRITICAL RISK)</span>
- `REQUEST_BANK_TRANSFER` $\rightarrow$ <span class="highlight-red">DENY (CRITICAL RISK)</span>
- `REQUEST_OTP` / `REQUEST_PIN` $\rightarrow$ <span class="highlight-red">DENY (CRITICAL RISK)</span>
- `REQUEST_REMOTE_ACCESS` $\rightarrow$ <span class="highlight-red">DENY (CRITICAL RISK)</span>
- **Zero Client Trust:** Server overrides and strips any client-supplied `decision: ALLOW`.

---

## Slide 7: Scam Reporting & Evidence Vault Integrity

### Immediate Citizen Protection & Digital Chain of Custody
When an unlawful demand is denied, citizens can instantly file an incident report with cryptographic evidence preservation:

<div class="grid-2">
  <div class="card">
    <strong class="highlight-blue">Evidence Ingestion Safeguards</strong>
    <ul>
      <li>Token-bound citizen identity prevents report spoofing.</li>
      <li>Strict file extension and MIME-type whitelist (PNG, JPEG, PDF, TXT only).</li>
      <li>Executable files (<code>.exe</code>, <code>.bat</code>, double extensions) rejected.</li>
      <li>Strict 10MB per-file upload ceiling.</li>
    </ul>
  </div>
  <div class="card">
    <strong class="highlight-green">Cryptographic Integrity Verification</strong>
    <ul>
      <li>Server calculates SHA-256 digest upon upload.</li>
      <li>Storage isolation in <code>storage/evidence/</code> directory.</li>
      <li>Dynamic verification: File bytes read from disk are matched against stored digest.</li>
      <li>Any byte modification flags an immediate <code>INTEGRITY_MISMATCH</code>.</li>
    </ul>
  </div>
</div>

### Administrative Triage & Privacy Isolation
- Multi-tier workflow: `SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `RESOLVED` / `DISMISSED`.
- **Confidential Investigator Notes:** Accessible only to administrators (`HTTP 403` for citizens).
- Citizens can only view their own submitted reports (IDOR protection).

---

## Slide 8: Inclusive Accessibility — Telephony IVR Simulation

### Bridging the Digital Divide
Over 40% of vulnerable citizens (rural communities, senior citizens) lack smartphones or reliable internet. Scammers exploit this gap. TrustGov provides an **interactive DTMF Voice Gateway**:

<div class="grid-2">
  <div class="card">
    <strong class="highlight-blue">Telephone Gateway Capabilities</strong>
    <ul>
      <li>Interactive DTMF keypad navigation with realistic audio tones.</li>
      <li>Alphanumeric officer code submission (e.g., <code>TG-OFF-001</code>).</li>
      <li>Spoken identity confirmation and verbal safety advisories.</li>
      <li>DTMF action safety check for telephone payment demands.</li>
      <li>Phone-based scam report filing with incident category selection.</li>
    </ul>
  </div>
  <div class="card">
    <strong class="highlight-red">Telephony Security Hardening</strong>
    <ul>
      <li><strong>Session TTL:</strong> 5-minute strict timeout per session (<code>TG-IVR-XXXXXXXX</code>).</li>
      <li><strong>Anti-Enumeration:</strong> Unknown codes return generic message without leaking DB presence.</li>
      <li><strong>Brute-Force Lockout:</strong> 5 consecutive failed attempts locks session immediately.</li>
      <li><strong>Privacy Tokenization:</strong> Phone numbers masked to <code>TEL-XXXXXXXXXXXX</code> in audit logs.</li>
    </ul>
  </div>
</div>

---

## Slide 9: Automated Test Results & Security Audit

### Comprehensive 387-Test Automated Verification Matrix

| Test Suite Scope | Total Tests | Passed | Pass Rate | Security Focus |
| :--- | :---: | :---: | :---: | :--- |
| **Smart Contract (Hardhat Registry)** | 24 | 24 | **100%** | Immutability, status transitions, access control |
| **Officer Management & RBAC** | 16 | 16 | **100%** | Role boundaries, status lockouts, audit logs |
| **DID & Cryptographic Identity** | 21 | 21 | **100%** | Ed25519 signature validity, key zero-leakage |
| **W3C Verifiable Credentials** | 25 | 25 | **100%** | Schema compliance, tamper detection, revocation |
| **Blockchain Anchoring & Immutability** | 15 | 15 | **100%** | On-chain registration, duplicate prevention |
| **Proof-of-Possession & QR Resolution** | 18 | 18 | **100%** | CSPRNG challenge nonces, anti-replay defense |
| **Citizen Verification Experience** | 22 | 22 | **100%** | Multi-channel lookup, IDOR isolation |
| **Authorization & Risk Engine** | 32 | 32 | **100%** | Hard denials, server derivation, policy immutability |
| **Scam Reporting & Evidence Vault** | 36 | 36 | **100%** | SHA-256 digests, MIME filters, investigator notes |
| **IVR Telephony Accessibility** | 42 | 42 | **100%** | DTMF state machine, lockout guards, PII masking |
| **Penetration & Security Hardening** | 61 | 61 | **100%** | SQLi, path traversal, prototype pollution, CSP headers |
| **Autonomous Master Suite & E2E** | 96 | 96 | **100%** | Cross-subsystem integration & browser user journey |
| **TOTAL VERIFIED TEST CASES** | **387** | **387** | **100%** | **Zero Failures, Zero TypeScript Errors** |

---

## Slide 10: Technical Honesty, Roadmap & Conclusion

### Transparent Boundary Disclosure: Implemented vs. Simulated
To ensure technical credibility, TrustGov maintains clear architectural distinctions:

| Architectural Component | Current Implemented Prototype | Proposed Production Integration |
| :--- | :--- | :--- |
| **Distributed Ledger** | Local Hardhat EVM (`TrustGovRegistry.sol`) | Ethereum Sepolia / Polygon L2 / Consortium Subnet |
| **Data Engine** | Schema-compatible deterministic `InMemoryDB` | High-Availability Managed PostgreSQL (Multi-AZ) |
| **Key Custody** | File-isolated mock keystore (`.keystore/`) | Hardware Security Module (HSM) / AWS CloudHSM / KMS |
| **Telephony Gateway** | Interactive in-browser DTMF Audio Simulator | Carrier-grade Twilio / Exotel Inbound Voice Webhooks |
| **Government Authority** | Simulated law enforcement agencies (CIB, ED) | Formal API integration with Ministry identity sources |

### Production Roadmap & Next Steps
1. **Infrastructure Phase (Staging):** Deploy managed PostgreSQL with SSL; deploy smart contract to Sepolia testnet.
2. **KMS Hardening:** Delegate all authority signing to cloud KMS asymmetric keys.
3. **Carrier Webhooks:** Bind institutional toll-free number to IVR voice webhook.

### Conclusion
TrustGov proves that cryptographic verification, immutable blockchain anchoring, and authoritative risk policies can decisively neutralize government impersonation and digital-arrest scams.
