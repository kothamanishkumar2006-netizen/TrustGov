# TrustGov Phase 3: DID & Cryptographic Identity Documentation

## 1. What is a Decentralized Identifier (DID)?
A **Decentralized Identifier (DID)** is a globally unique, cryptographically verifiable identifier that does not depend on a centralized identity provider, certificate authority, or single government database. Designed according to the World Wide Web Consortium (W3C) Decentralized Identifiers specification, a DID enables an entity (in this case, an authorized government officer) to prove their identity and authenticate official communications cryptographically.

---

## 2. Why TrustGov Uses a DID
Traditional impersonation scams (digital arrest scams, fake CBI/police notices, coercive extortion calls) succeed because scammers exploit visual mimicry (fake badges, forged logos, spoofed numbers, fake uniforms). 
TrustGov replaces visual trust with **cryptographic trust**:
- Instead of trusting a phone caller or video claim, citizens and automated verification systems verify the officer's cryptographic identity.
- The DID provides an immutable, verifiable anchor for issuing Verifiable Credentials (Phase 4) and smart contract registry anchoring (Phase 5).
- DIDs allow instant verification of whether an officer is currently on active duty or suspended/revoked, preventing rogue or impersonating actors from claiming legitimate authority.

---

## 3. What is the DID Format?
TrustGov uses the following prototype uniform resource identifier (URI) format:
```
did:trustgov:<unique-uuid>
```
**Example:**
```
did:trustgov:8f3b1c2a-7a91-4d7d-91a5-e3b8a1c90d54
```
The identifier component uses cryptographically secure UUID version 4 (`crypto.randomUUID()`). 

> [!NOTE]
> The DID contains **zero sensitive personal information**. It does not reveal an officer's phone number, personal email, home address, Aadhaar number, or credentials.

---

## 4. Why `did:trustgov` is a Prototype Method
The `did:trustgov` method is a **project-specific prototype DID method**. 
- It is **NOT** an officially registered W3C DID method in the W3C DID Method Registry.
- The architecture is explicitly decoupled and modular so that it can be cleanly transitioned or bridged to standard production methods (e.g., `did:ion`, `did:indy`, `did:key`, `did:cheqd`, or a sovereign national public blockchain DID) in future iterations without rewriting the core application.

---

## 5. What is Ed25519?
**Ed25519** is an Edwards-curve Digital Signature Algorithm (EdDSA) operating over Curve25519.
Key properties:
- **Fast and Lightweight**: Offers rapid signature generation and verification with low CPU overhead.
- **High Security**: Provides ~128 bits of cryptographic security, outperforming traditional 2048-bit RSA while using 32-byte public keys and 64-byte signatures.
- **Resilience**: Designed to be resilient against side-channel attacks, fault attacks, and hash collision attacks (employing SHA-512 internally).
- **Standards**: Widely adopted across TLS, SSH, modern blockchains (Solana, Polkadot, NEAR), and W3C DID / Verifiable Credential specifications.

---

## 6. Difference Between Public and Private Keys
Asymmetric cryptography uses a mathematically linked key pair:
1. **Public Key (`publicKey`)**:
   - Shared openly with the public, citizens, verifiers, and published in the DID Document.
   - Encoded as a W3C multibase string (`z...`) using Base58btc with the standard Ed25519 multicodec prefix (`0xed01`).
   - Purpose: Verifies digital signatures created by the corresponding private key. Anyone can verify, but nobody can forge.
2. **Private Key (`privateKey`)**:
   - Highly confidential secret mathematical parameter.
   - Used to generate cryptographic digital signatures on official requests, notices, and challenge responses.
   - Treated with strict security isolation.

---

## 7. Why Private Keys are NOT Stored in the Database
Storing private keys in any central database (PostgreSQL, Supabase, etc.) creates a catastrophic single point of failure:
- A database leak, SQL injection, insider threat, or backup breach would compromise the private keys of all government officers, enabling attackers to sign fraudulent warrants or extortion notices.
- By architectural security policy:
  - **The database only stores public keys, DIDs, key types, and identity statuses.**
  - Private keys are **NEVER** stored in PostgreSQL, returned in REST APIs, held in frontend state/localStorage, or logged.
  - In our development test harness, private keys are generated and used transiently in-memory for signature proof and discarded immediately.

---

## 8. What is a DID Document?
A **DID Document** is a structured, standardized JSON/JSON-LD document describing the public cryptographic and verification properties of a DID.
**Example DID Document returned by TrustGov:**
```json
{
  "@context": [
    "https://www.w3.org/ns/did/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1"
  ],
  "id": "did:trustgov:550e8400-e29b-41d4-a716-446655440000",
  "verificationMethod": [
    {
      "id": "did:trustgov:550e8400-e29b-41d4-a716-446655440000#key-1",
      "type": "Ed25519VerificationKey2020",
      "controller": "did:trustgov:550e8400-e29b-41d4-a716-446655440000",
      "publicKeyMultibase": "z6MkemMNhF7WuBVhjeSexMQfCn9EJRgp3H43ULEjPGz9RpUJ"
    }
  ],
  "authentication": [
    "did:trustgov:550e8400-e29b-41d4-a716-446655440000#key-1"
  ],
  "assertionMethod": [
    "did:trustgov:550e8400-e29b-41d4-a716-446655440000#key-1"
  ],
  "status": "ACTIVE",
  "metadata": {
    "method": "did:trustgov",
    "isPrototype": true,
    "disclaimer": "Prototype DID method for TrustGov project. Not an officially registered W3C DID method.",
    "keyType": "Ed25519"
  }
}
```

---

## 9. How DID Resolution Works
DID Resolution is the process of taking a DID URI and retrieving its corresponding DID Document:
1. Client makes an HTTP GET request: `GET /api/did/:did`
2. **Format Validation**: The endpoint validates the format against `^did:trustgov:[0-9a-fA-F-]{36}$`. If malformed, it returns `400 Bad Request`.
3. **Registry Lookup**: Queries `did_identities` table for the matching DID. If not found, returns `404 Not Found`.
4. **Document Construction**: Constructs the standard W3C DID Document using the stored Ed25519 multibase public key, controller identifier, and current status.
5. **Safe Response**: Returns the DID Document with proper HTTP 200 headers, containing only public verification material.

---

## 10. How Officer Status Affects DID Status
TrustGov enforces strict synchronization between the officer record and their cryptographic identity:
```
Officer ACTIVE     ──>  DID ACTIVE
Officer SUSPENDED  ──>  DID SUSPENDED
Officer REVOKED    ──>  DID REVOKED
```
When an administrator modifies an officer's status in Phase 2 (`PATCH /api/admin/officers/:id/status`):
- The `did_identities` status is automatically updated to reflect the new status.
- A tamper-evident audit record `DID_STATUS_CHANGED` is emitted.
- When resolving the officer's DID (`GET /api/did/:did`), the status immediately shows `SUSPENDED` or `REVOKED`.
- Suspended and revoked officers cannot be verified as active trusted identities.

---

## 11. How Phase 4 Will Use the DID
In **Phase 4: Verifiable Credentials (VC)**:
- The government authority issues digital credentials (e.g. Officer Badge Credential, Search Warrant Credential, Official Notice Credential) signed by the department.
- The `subject_did` in each Verifiable Credential will point to the officer's `did:trustgov:<uuid>`.
- The credential will contain specific authorized scopes (e.g. `ALLOWED: [DOCUMENT_REQUEST, OFFICIAL_NOTICE]`, `DISALLOWED: [PERSONAL_UPI_PAYMENT, OTP_REQUEST]`).

---

## 12. How Phase 5 Will Connect the Identity to Blockchain
In **Phase 5: Blockchain Registry**:
- The cryptographic DID and public verification key will be anchored on-chain in an immutable smart contract registry.
- Revocations and suspensions will be written to the blockchain registry as immutable transactions.
- Even if a centralized server is temporarily offline or compromised, verifiers can check the blockchain directly to establish trust.

---

## 13. Production Key-Management Limitations & Roadmap
Our current prototype demonstrates the full cryptographic sign/verify pipeline safely without storing private keys in the database.
For a live, production-grade national deployment:
- **Cloud KMS / HSM**: Officers' signing keys are provisioned inside FIPS 140-2 Level 3 Hardware Security Modules (e.g., AWS CloudHSM, Google Cloud KMS, Azure Dedicated HSM) or secure government enclave infrastructure.
- **Hardware Wallets / YubiKeys**: Field officers can hold private keys on hardware security tokens (PIV / FIDO2 / Ed25519 smart cards).
- **Zero Custody**: Government officers sign verification challenges client-side via hardware-isolated biometric key stores, ensuring not even system administrators can forge officer signatures.
