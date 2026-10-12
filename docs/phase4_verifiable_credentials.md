# TrustGov Phase 4: Verifiable Credentials (VC) Documentation

## 1. What is a Verifiable Credential (VC)?
A **Verifiable Credential (VC)** is a tamper-evident, cryptographically verifiable digital statement issued by an authoritative entity about a subject. Standardized by the **World Wide Web Consortium (W3C)**, Verifiable Credentials represent the digital equivalent of physical government credentials (such as badges, warrants, and appointment letters), but with mathematical trust rather than visual trust.

A Verifiable Credential contains:
- **Claims**: Statements asserting the officer's full name, officer code, department, designation, and jurisdiction.
- **Subject Identifier**: The officer's Decentralized Identifier (`did:trustgov:<uuid>`).
- **Issuer Identifier**: The National Issuance Authority's DID (`did:trustgov:a0000000-0000-4000-8000-000000000001`).
- **Cryptographic Proof**: An Ed25519 digital signature generated over the canonicalized claims, verifiable by anyone with the issuer's public key.

---

## 2. Why TrustGov Uses Verifiable Credentials
Traditional impersonation scams—such as "digital arrest" extortion schemes, fake CBI notices, forged arrest warrants, and rogue police phone calls—succeed because visual indicators are trivial to fake:
- Scammers create fraudulent police badges, counterfeit departmental letterheads, and spoof caller IDs.
- Victims cannot distinguish a genuine investigation call from an extortionist.

TrustGov replaces visual trust with **cryptographic certainty**:
1. **Mathematical Tamper-Proofing**: Any modification of claims (e.g. altering the officer name, department, or expiration date) immediately breaks the Ed25519 digital signature.
2. **Instant Public Verification**: Citizens can enter an Officer Code, Credential ID, or DID into the TrustGov Citizen Protection Hub and verify the officer in seconds.
3. **Explicit Anti-Scam Guardrails**: The credential verification interface explicitly flags prohibited demands (e.g. "Government officers are NEVER authorized to demand personal UPI/bank transfers or request OTPs/passwords").
4. **Instant Revocation & Cascades**: When an officer is suspended or revoked by department administrators, their Verifiable Credentials immediately cascade to `SUSPENDED` or `REVOKED`, instantly blocking fraudulent abuse of former authority.

---

## 3. W3C Data Model & TrustGov Credential Structure

TrustGov adheres to the W3C Verifiable Credentials Data Model 1.0.

### Example Verifiable Credential (JSON):
```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1"
  ],
  "id": "urn:uuid:6a438d1e-8e68-45e0-8f92-563b01a734e1",
  "type": [
    "VerifiableCredential",
    "GovernmentOfficerCredential"
  ],
  "issuer": "did:trustgov:a0000000-0000-4000-8000-000000000001",
  "issuanceDate": "2026-09-19T06:00:00.000Z",
  "validFrom": "2026-09-19T06:00:00.000Z",
  "validUntil": "2027-09-19T06:00:00.000Z",
  "credentialSubject": {
    "id": "did:trustgov:8f3b1c2a-7a91-4d7d-91a5-e3b8a1c90d54",
    "officerCode": "TG-OFF-001",
    "fullName": "Rajesh Kumar",
    "department": "Central Investigation Bureau",
    "designation": "Superintendent of Police",
    "jurisdiction": "New Delhi Zone",
    "officialEmail": "officer@cib.gov.in"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-09-19T06:00:00.000Z",
    "verificationMethod": "did:trustgov:a0000000-0000-4000-8000-000000000001#key-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "3b2e5917a2e8c..."
  }
}
```

---

## 4. Deterministic Canonicalization (RFC 8785) & Ed25519 Signing

In JSON, key order is mathematically arbitrary: `{"a":1,"b":2}` and `{"b":2,"a":1}` represent identical data but have different byte hashes.

To ensure deterministic signature creation and verification:
1. **Canonicalization**: Prior to signing, the unsigned credential payload is processed using an RFC 8785-aligned recursive key sorter (`canonicalize()`), ensuring keys are sorted in strict lexicographical order with consistent formatting.
2. **Ed25519 Digital Signing**: The canonical byte string is signed using the National Issuance Authority's Ed25519 private key.
3. **Verification**: When a verifier inspects the credential, the signature proof is detached, the payload is canonically reconstructed, and `crypto.verify(null, canonicalBuffer, issuerPublicKey, signatureBuffer)` is executed.

---

## 5. TrustGov National Credential Issuance Authority

The Issuance Authority is represented by a prototype DID:
```
did:trustgov:a0000000-0000-4000-8000-000000000001
```
- **Verification Method**: `did:trustgov:a0000000-0000-4000-8000-000000000001#key-1`
- **Key Algorithm**: Ed25519 (`Ed25519VerificationKey2020`)
- **Key Multibase**: Standard W3C multibase encoding (`z6M...`) with `0xed01` codec prefix.

---

## 6. Strict Security Architecture: Zero Custody of Private Keys

> [!IMPORTANT]
> **No private keys are stored in the database.**
> - Central database storage of private keys is a catastrophic vulnerability. A database dump or SQL injection would expose the signing keys of officers and the authority.
> - PostgreSQL only stores public keys, multibase strings, DIDs, and signed credential payloads.
> - Private keys are never returned in REST endpoints, never logged in audit trails, and never transmitted to frontend clients.

---

## 7. Credential Lifecycle & Cascade Rules

### 1:1 Active Credential Rule
An officer may have at most **one active Government Officer Credential** at any time. Attempting to issue a second active credential returns `409 Conflict` (`CREDENTIAL_ALREADY_EXISTS`).

### Status Transitions:
```
[ACTIVE] ────> [SUSPENDED] ────> [ACTIVE] (Reactivation)
   │                  │
   └──────────┬───────┘
              ▼
          [REVOKED] (Permanent & Irreversible)
```

### Cascade Invalidation Matrix:
When an administrator updates an officer's duty status in Phase 2:
- **Officer Suspended**: All active credentials linked to the officer are automatically updated to `SUSPENDED`, and an audit event `CREDENTIAL_SUSPENDED` is recorded.
- **Officer Revoked**: All non-revoked credentials linked to the officer are permanently set to `REVOKED`, and an audit event `CREDENTIAL_REVOKED` is recorded.
- **Revoked Officers**: Attempting to issue a Verifiable Credential to a revoked officer is strictly rejected with `400 Bad Request` (`OFFICER_REVOKED`).

---

## 8. Verification Pipeline in Citizen & Officer Dashboards

When a citizen or system initiates verification:
1. **Identifier Resolution**: Supports resolution by Credential ID (`VC-TG-...`), Officer Code (`TG-OFF-...`), or Officer DID (`did:trustgov:...`).
2. **Ed25519 Signature Check**: Validates digital signature against National Issuance Authority public key.
3. **Issuer Check**: Confirms issuer is authorized National Authority.
4. **Subject Check**: Verifies subject DID matches officer identity.
5. **Status & Expiration Checks**: Confirms credential is not revoked, suspended, or expired.
6. **Officer Cascade Check**: Verifies the underlying officer record is on active duty.
7. **Anti-Scam Guardrails**: If the citizen reports that the officer demanded funds or OTPs, the interface triggers a prominent **CRITICAL FRAUD WARNING**, alerting the citizen that legitimate officers never ask for personal transfers or authentication secrets.

---

## 9. Production KMS/HSM Integration Roadmap & Phase 5

In a live production deployment:
- **Hardware Security Modules (HSMs)**: The National Issuance Authority signing key is stored in a FIPS 140-2 Level 3 HSM (e.g. AWS CloudHSM, Google Cloud KMS, or sovereign national enclave).
- **Phase 5 (Blockchain Registry Anchoring)**: The cryptographic status of DIDs and Verifiable Credentials will be anchored to an immutable smart contract registry, allowing decentralized, zero-downtime verification independent of central database availability.
