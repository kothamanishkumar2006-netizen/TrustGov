# TrustGov Phase 6: Secure Officer Proof-of-Possession, Challenge-Response, & QR Verification Architecture

## 1. Executive Summary & Purpose

The **TrustGov Proof-of-Possession & Cryptographic Challenge-Response Architecture** solves the fundamental flaw of traditional identification systems: **passive credentials can be observed, photographed, or copied by impostors**.

In conventional systems, knowing an officer's name, employee ID, badge number, or displaying a stolen QR code is often sufficient to deceive unsuspecting citizens into paying extortion fees, falling victim to "digital arrests", or transferring funds to fraudulent accounts.

Phase 6 implements a zero-trust cryptographic challenge-response protocol:
1. **Interactive Proof of Key Possession**: Even if an impostor knows a real officer's public ID, badge number, DID, and valid Verifiable Credential, they **cannot** pass verification without live cryptographic control of the officer's private Ed25519 signing key.
2. **Deterministic Canonical Challenge (RFC 8785)**: Every challenge generates a fresh 32-byte CSPRNG nonce, unique UUID, strict 5-minute TTL, and target audience, sorted canonically before signing.
3. **Single-Use Replay Attack Protection**: Verification challenges transition immediately from `PENDING` to `USED` upon verification. Replayed or duplicated challenge signatures are rejected with HTTP 409 (`CHALLENGE_ALREADY_USED`).
4. **Safe QR Badges**: TrustGov QR codes encode only a safe URI reference (`TRUSTGOV://verify/<credentialId>`). QR codes **never** contain private keys, seed phrases, or sensitive PII.
5. **Decoupled 5-Tier Verification Pipeline**: Verification validates:
   - Tier 1: DID Identity Resolution (`did:trustgov:...`)
   - Tier 2: W3C Verifiable Credential Authenticity (Ed25519 Signature)
   - Tier 3: Officer Active Authorization & In-Good-Standing Status
   - Tier 4: Live Proof of Possession (Cryptographic Challenge Signature)
   - Tier 5: Immutable Blockchain Anchor & Hash Match (`TrustGovRegistry.sol`)

---

## 2. Cryptographic Threat Model & Defense Matrix

| Attack Vector | Attacker Strategy | TrustGov Phase 6 Defense | Outcome |
| :--- | :--- | :--- | :--- |
| **Impersonation with Public Badge** | Scammer shows photo of legitimate officer badge or reads public Officer Code | Platform issues live CSPRNG challenge. Scammer cannot produce Ed25519 private key signature | **BLOCKED (400 INVALID_SIGNATURE)** |
| **Replay Attack** | Scammer intercepts an authentic officer signature from a previous session and replays it | Challenges are single-use (`USED`) and strictly bound to unique nonce and UUID. Second attempt rejected | **BLOCKED (409 CHALLENGE_ALREADY_USED)** |
| **Expired Signature Reuse** | Scammer uses a signature after time lapse | Challenges enforce strict 5-minute (300-second) TTL; expired nonces rejected automatically | **BLOCKED (400 CHALLENGE_EXPIRED)** |
| **QR Code Cloning** | Scammer screenshots or prints an officer's QR badge | QR badge is purely a reference (`TRUSTGOV://verify/...`). Citizen scan automatically spawns a live challenge requiring immediate signing | **BLOCKED without private key custody** |
| **MitM Payload Modification** | Intermediary modifies challenge timestamp or audience | Challenge is verified using deterministic RFC 8785 canonical serialization; any bit flip causes Ed25519 verification failure | **BLOCKED (400 INVALID_SIGNATURE)** |
| **Cross-Officer Signature Spoofing** | Officer A attempts to sign a challenge issued to Officer B | `signChallenge` validates caller identity matches challenge target officer; cross-signing forbidden | **BLOCKED (403 FORBIDDEN)** |
| **Suspended Officer Demands** | Disciplinary-suspended officer attempts to sign citizen challenge | Proof-of-possession pipeline checks live officer, DID, and VC status; rejected if not `ACTIVE` | **BLOCKED (403 OFFICER_SUSPENDED)** |
| **Illegal Demands (Scam Guardrail)** | Verified officer or scammer demands OTP, card PIN, or personal UPI transfer | Anti-scam guardrail flags illegal demand in red banner regardless of identity verification | **BLOCKED (CRITICAL SCAM WARNING)** |

---

## 3. Key Custody Boundary (`KeyProvider` Abstraction)

### Invariant: Zero Private Key Leakage
Private keys are **strictly forbidden** from existing in:
- Database tables (PostgreSQL, Supabase)
- Memory pool caches
- JWT authentication tokens
- Frontend browser memory, `localStorage`, `sessionStorage`
- API request or response bodies
- URL parameters or QR code payloads
- Blockchain transactions or audit logs

### Interface: `IKeyProvider` (`backend/src/services/keyProvider.ts`)
```typescript
export interface IKeyProvider {
  createKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }>;
  getPublicKey(officerId: string): Promise<string | null>;
  sign(canonicalPayload: string, officerId: string): Promise<string>;
  keyExists(officerId: string): Promise<boolean>;
  getKeyMetadata(officerId: string): Promise<KeyMetadata | null>;
  rebindKey(officerId: string, did: string): Promise<{ publicKeyMultibase: string }>;
}
```

### Prototype Custody (`DevelopmentKeyStore`):
- Private keys reside in an isolated local filesystem keystore directory (`.keystore/`), protected by restrictive operating system file permissions.
- `.keystore/`, `*.key`, and `*.pem` are strictly git-ignored.
- Only the `keyProvider.sign(canonicalPayload, officerId)` method can access key material to execute raw Ed25519 signing. The raw private key is never returned or leaked across the module boundary.
- In production, this interface connects directly to hardware security modules (HSM) such as AWS CloudHSM, Google Cloud KMS, or FIPS 140-2 Level 3 hardware appliances.

---

## 4. Deterministic Canonical Challenge Protocol (RFC 8785)

### Challenge Generation:
When a citizen or system requests a challenge for an officer:
1. `crypto.randomBytes(32).toString('hex')`: Generates a 256-bit cryptographically secure pseudorandom nonce.
2. `challengeId`: Generated as `CHG-${crypto.randomUUID()}`.
3. `issuedAt`: Current ISO timestamp (`NOW()`).
4. `expiresAt`: Current ISO timestamp + 5 minutes (`300,000 ms`).
5. `audience`: `'trustgov-citizen-verifier'`.

### Canonical Payload Structure:
```json
{
  "audience": "trustgov-citizen-verifier",
  "challengeId": "CHG-f8dda9a1-9c31-4927-bc83-75d4848f3cab",
  "did": "did:trustgov:550e8400-e29b-41d4-a716-446655440001",
  "expiresAt": "2026-09-22T16:02:18.680Z",
  "issuedAt": "2026-09-22T15:57:18.680Z",
  "nonce": "29694a45a96154084a221e54d619f609a9fc9c06670b0ece363f9a58adf7fc18",
  "type": "TrustGovProofOfPossession"
}
```
The payload is serialized deterministically via RFC 8785 JSON canonicalization rules (alphabetical key ordering, consistent numeric and string formatting) prior to signing and verification.

---

## 5. Replay Attack Protection & State Machine

Every challenge follows an immutable one-way lifecycle state machine:

```
    ┌──────────┐
    │ PENDING  │  (Issued, 5-minute TTL active)
    └────┬─────┘
         │
         ├───► [Time > 5 min] ───────► [EXPIRED] (HTTP 400 CHALLENGE_EXPIRED)
         │
         ├───► [Signature Tampered] ──► [FAILED]  (HTTP 400 INVALID_SIGNATURE)
         │
         └───► [Verified Pass] ───────► [USED]    (Status consumed)
                                          │
                                          └──► Replay Attempt ──► REJECTED (HTTP 409 CHALLENGE_ALREADY_USED)
```

1. **Atomic Consumption**: When `verifyProofOfPossession` verifies an Ed25519 signature successfully, it updates the challenge database record atomically:
   ```sql
   UPDATE verification_challenges
   SET status = 'USED', used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE challenge_id = $1 AND status = 'PENDING';
   ```
2. **Replay Rejection**: If an attacker attempts to re-submit the same signature, the query finds status `'USED'` and immediately rejects with HTTP 409 (`CHALLENGE_ALREADY_USED`).

---

## 6. Safe QR Badges vs False Trust

### QR Code URI Scheme:
TrustGov QR badges encode a URI reference adhering to the following specification:
```
TRUSTGOV://verify/<credentialId>
```
Example:
```
TRUSTGOV://verify/VC-TG-TG-OFF-001-4D78E09B
```

### Critical Security Principles:
1. **QR Codes Are Pointers, Not Proofs**: A QR code simply tells the citizen scanner where to look up official public records. Displaying a QR code proves nothing on its own because anyone can photograph or display a QR code.
2. **Automatic Challenge Spawn**: When a citizen scans a TrustGov QR badge:
   - The scanner parses and validates the `TRUSTGOV://verify/...` URI.
   - The system automatically issues a fresh, live challenge bound to that officer's DID.
   - The officer must sign the live challenge from their authenticated mobile device to prove active physical possession of their cryptographic key.

---

## 7. 5-Tier Verification Pipeline

When a citizen verifies an officer using TrustGov, five distinct security tiers are independently evaluated:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TRUSTGOV 5-TIER VERIFICATION                    │
├──────┬──────────────────────┬──────────────────────────────────────────┤
│ TIER │ CHECK                │ WHAT IT PROVES                           │
├──────┼──────────────────────┼──────────────────────────────────────────┤
│ 1    │ DID Resolution       │ DID identity document is registered,     │
│      │                      │ active, and public key is bound          │
├──────┼──────────────────────┼──────────────────────────────────────────┤
│ 2    │ W3C Credential       │ Authentic Ed25519 digital signature from │
│      │ Authenticity         │ National Issuance Authority              │
├──────┼──────────────────────┼──────────────────────────────────────────┤
│ 3    │ Officer Status       │ Officer is in good standing (ACTIVE) and │
│      │ Authorization        │ authorized for official duties           │
├──────┼──────────────────────┼──────────────────────────────────────────┤
│ 4    │ Proof-of-Possession  │ Valid live challenge signature generated │
│      │ (Ed25519)            │ by officer's secure private key          │
├──────┼──────────────────────┼──────────────────────────────────────────┤
│ 5    │ Blockchain Anchor    │ Cryptographic hash verified against      │
│      │ Integrity            │ TrustGovRegistry.sol on-chain ledger     │
└──────┴──────────────────────┴──────────────────────────────────────────┘
```

---

## 8. Anti-Scam Guardrails: Illegal Demands Protection

Even if an officer's identity is 100% verified, scammers often impersonate real officers and demand actions that **no legitimate government officer or law enforcement agency is authorized to take**:
- Transferring money to personal bank accounts or UPI IDs ("bail", "settlement fees", "digital arrest clearance")
- Requesting One-Time Passwords (OTPs)
- Demanding ATM card PINs or net-banking passwords

TrustGov intercepts the citizen's reported demand:
- If the claimed action involves funds transfers or secret disclosure, a **prominent red warning banner** is rendered immediately:
  > **CRITICAL SCAM WARNING: ILLEGAL DEMAND**
  > No government agency is ever authorized to demand personal UPI payments or OTPs. Terminate the call immediately.

---

## 9. API Endpoints Reference

### Public Citizen Verification Endpoints:
- `POST /api/verification/challenge`: Generate live verification challenge for officer code/DID.
- `POST /api/verification/verify-proof`: Verify officer signature and execute 5-tier checks.
- `POST /api/verification/qr-resolve`: Resolve scanned QR badge data and auto-issue challenge.

### Authenticated Officer Portal Endpoints:
- `GET /api/officer/proof/pending`: Retrieve active pending challenges issued for this officer.
- `POST /api/officer/proof/sign`: Sign an incoming challenge using key custody abstraction.

### Authenticated Admin Endpoints:
- `POST /api/admin/officers/:id/provision-key`: Provision or rebind an officer's signing key.

---

## 10. Hardware Security Module (HSM) & Production Roadmap

For the prototype and development environment, private keys are securely isolated in local files under `.keystore/` with strict read/write boundaries. For production deployment:
1. **FIPS 140-2 Level 3 HSM / Cloud KMS Integration**: Replace `DevelopmentKeyStore` with an `HSMKeyProvider` implementing PKCS#11 or AWS CloudHSM / Google Cloud KMS APIs.
2. **Mobile Secure Enclave**: Support officer mobile app signing utilizing device biometric Secure Enclave (Apple iOS Secure Enclave / Android StrongBox Keymaster) with WebAuthn/FIDO2.
3. **Threshold Cryptography**: Introduce multi-party computation (MPC) / threshold signing for high-risk warrants and inter-agency asset seizures.
