# TrustGov Phase 5: Blockchain Registry & Smart Contract Integrity Documentation

## 1. What is the TrustGov Blockchain Registry?
The **TrustGov Blockchain Registry** is a decentralized, tamper-proof, and append-only ledger layer built on Ethereum-compatible smart contracts (`TrustGovRegistry.sol`). It anchors the cryptographic hashes and lifecycle statuses of Decentralized Identifiers (DIDs) and W3C Verifiable Credentials (VCs).

By anchoring cryptographic proofs to an immutable blockchain, TrustGov eliminates the **single point of trust** inherent in traditional government databases. Even if a centralized server is breached, database records modified, or administrative accounts compromised, any alteration of an officer's credential is mathematically exposed in real-time by comparing canonical hashes against the on-chain registry.

---

## 2. Dual-Layer Trust Architecture

TrustGov establishes a **defense-in-depth cryptographic trust model**:

```
┌────────────────────────────────────────────────────────┐
│               LAYER 1: W3C Ed25519 Cryptographic Proof   │
│  - National Issuance Authority digital signature       │
│  - RFC 8785 deterministic canonicalization             │
│  - Validates authenticity of claims & issuer identity   │
└──────────────────────────┬─────────────────────────────┘
                           │ Anchored via SHA-256
                           ▼
┌────────────────────────────────────────────────────────┐
│               LAYER 2: Ethereum Smart Contract Registry │
│  - TrustGovRegistry.sol on EVM network                  │
│  - Immutable registration timestamp & block number     │
│  - On-chain status transitions (ACTIVE/SUSPENDED/REVOKED)│
│  - Anti-tampering & decentralized public verification   │
└────────────────────────────────────────────────────────┘
```

1. **Layer 1 (Cryptographic Signature)**: Proves that the National Issuance Authority signed the specific claims (officer code, name, department, jurisdiction) using Ed25519.
2. **Layer 2 (Blockchain Immutability)**: Proves that the credential existed at a verifiable timestamp in history, has not been retroactively tampered with, and reflects the current canonical lifecycle state (Active, Suspended, or Permanently Revoked).

---

## 3. Privacy Architecture: Zero Personal Data On-Chain

> [!IMPORTANT]
> **No Personally Identifiable Information (PII) is ever written to the blockchain.**
> - Centralized or decentralized public ledgers are immutable and publicly queryable forever.
> - Storing names, phone numbers, email addresses, employee IDs, or government credentials on a blockchain violates Indian Digital Personal Data Protection (DPDP) Act, GDPR, and fundamental citizen privacy standards.

### What is stored on-chain:
- **`credentialHash` (`bytes32`)**: SHA-256 cryptographic hash calculated over the deterministic RFC 8785 canonical JSON string of the complete Verifiable Credential.
- **`officerDIDHash` (`bytes32`)**: SHA-256 hash of the officer's DID string (`did:trustgov:<uuid>`).
- **`issuerDIDHash` (`bytes32`)**: SHA-256 hash of the National Authority's DID string.
- **`status` (`uint8`)**: Numeric lifecycle enum (1 = ACTIVE, 2 = SUSPENDED, 3 = REVOKED).
- **`registeredAt` (`uint256`)**: Blockchain block timestamp of original anchoring.

### What is NEVER stored on-chain:
- No officer names, emails, phone numbers, or jurisdictions.
- No private keys, mnemonics, seeds, or wallet secrets.
- No raw credential payloads or unhashed JSON documents.

---

## 4. Solidity Smart Contract Architecture: `TrustGovRegistry.sol`

### Contract Interface & Storage Layout:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TrustGovRegistry {
    enum CredentialStatus { NONE, ACTIVE, SUSPENDED, REVOKED }

    struct DIDRecord {
        bytes32 didHash;
        bool registered;
        uint256 registeredAt;
    }

    struct CredentialRecord {
        bytes32 credentialHash;
        bytes32 officerDIDHash;
        bytes32 issuerDIDHash;
        CredentialStatus status;
        uint256 registeredAt;
        bool registered;
    }

    address public owner;
    mapping(bytes32 => DIDRecord) private didRegistry;
    mapping(bytes32 => CredentialRecord) private credentialRegistry;

    // Events
    event DIDRegistered(bytes32 indexed didHash, uint256 timestamp);
    event CredentialRegistered(bytes32 indexed credentialHash, bytes32 indexed officerDIDHash, bytes32 indexed issuerDIDHash, CredentialStatus status, uint256 timestamp);
    event CredentialStatusUpdated(bytes32 indexed credentialHash, CredentialStatus status, uint256 timestamp);
}
```

### Core Security Invariants Enforced by Smart Contract:
1. **Access Control (`onlyOwner`)**: Only authorized sovereign issuance entities can invoke state-mutating functions (`registerDID`, `registerCredential`, `updateCredentialStatus`).
2. **Replay & Duplicate Rejection**: Registering an already anchored DID or credential reverts with custom error `DIDAlreadyRegistered` or `CredentialAlreadyRegistered`.
3. **Strict State Machine (Irreversible Revocation)**:
   - `ACTIVE` ➔ `SUSPENDED`: Allowed (temporary investigation / leave).
   - `SUSPENDED` ➔ `ACTIVE`: Allowed (reinstatement).
   - `ACTIVE` / `SUSPENDED` ➔ `REVOKED`: Allowed (permanent termination).
   - `REVOKED` ➔ Any State: **STRICTLY REVERTED** with `CannotChangeRevokedStatus()`. Once revoked on-chain, authority can never be restored.

---

## 5. Deterministic RFC 8785 Canonical Hashing

To compute a verifiable `bytes32` hash from JSON objects:
1. JSON keys are recursively sorted in lexicographical order per **RFC 8785 (JSON Canonicalization Scheme)**.
2. The canonicalized UTF-8 byte stream is hashed using SHA-256:
```typescript
const canonical = canonicalize(credentialPayload);
const credentialHash = '0x' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
```
Any alteration of a single character—such as changing an officer's rank or expiry date—produces a completely different SHA-256 digest, immediately failing the on-chain integrity check.

---

## 6. End-to-End Verification Pipeline

When a citizen or system initiates verification via the Citizen Protection Hub:

```
Citizen enters Officer Code, DID, or Credential ID
                 │
                 ▼
Fetch Credential from Database
                 │
                 ├──────────────────────────────────────────────────────┐
                 ▼                                                      ▼
[Layer 1: Ed25519 Signature Check]             [Layer 2: Blockchain Smart Contract Check]
Detaches proof & canonicalizes payload         Computes RFC 8785 SHA-256 digest
crypto.verify(payload, pubKey, sig)            Calls verifyCredentialHash(computedHash)
                 │                                                      │
                 ▼                                                      ▼
✓ Signature mathematically authentic           ✓ Hash matches on-chain entry (100% integrity)
✓ Authority verified                            ✓ Status is ACTIVE
                 │                                                      │
                 └──────────────────────┬───────────────────────────────┘
                                        ▼
                   CRITICAL ANTI-SCAM RULES EVALUATED
   (Does citizen report illegal demands for UPI / OTP / Cash?)
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼                                                         ▼
[NO ILLEGAL DEMANDS]                                      [ILLEGAL DEMAND DETECTED]
Green Shield Displayed                                    CRITICAL FRAUD WARNING TRIGGERED
Official confirmed on active duty                         "NO GOV OFFICER IS EVER AUTHORIZED
Full name, rank, badge, department shown                  TO DEMAND PERSONAL UPI TRANSFERS OR OTPS"
```

---

## 7. Officer Lifecycle & Automatic Blockchain Cascades

When an administrator updates an officer's status in the TrustGov Admin Portal:
1. **Officer Suspended**:
   - PostgreSQL officer status updated to `SUSPENDED`.
   - Linked active Verifiable Credentials cascaded to `SUSPENDED`.
   - `blockchainService.updateCredentialStatus(credHash, 'SUSPENDED')` executes smart contract transaction.
   - Immutable audit trail records `CREDENTIAL_SUSPENDED` with blockchain transaction hash.
2. **Officer Revoked**:
   - PostgreSQL officer status updated to `REVOKED`.
   - Linked credentials permanently transitioned to `REVOKED`.
   - Smart contract updates status to `REVOKED` (permanent & non-reversible).
   - Any future issuance attempt for the officer is blocked with `400 Bad Request` (`OFFICER_REVOKED`).

---

## 8. Hardhat Test Coverage & Validation

The smart contract test suite (`blockchain/test/TrustGovRegistry.test.ts`) achieves **100% test passing (24/24 tests)**:
- **Deployment & Ownership**: Deployer owner assignment, ownership transfers, zero address protection.
- **DID Registration**: On-chain DID registration, duplicate rejection, zero-hash rejection, unauthorized caller rejection.
- **Credential Registration**: Active registration, hash retrieval, duplicate prevention, unauthorized caller prevention.
- **Lifecycle & State Transitions**:
  - `ACTIVE` ➔ `SUSPENDED` (Valid)
  - `SUSPENDED` ➔ `ACTIVE` (Valid)
  - `ACTIVE` ➔ `REVOKED` (Valid)
  - `SUSPENDED` ➔ `REVOKED` (Valid)
  - `REVOKED` ➔ `ACTIVE` (**Rejected - Permanent Revocation**)
  - `REVOKED` ➔ `SUSPENDED` (**Rejected - Permanent Revocation**)

---

## 9. Production Deployment Roadmap & Enterprise Anchoring

For production enterprise deployment:
1. **Consortium / Sovereign L2**: Deploy `TrustGovRegistry` smart contract on a sovereign national consortium chain (e.g., Polygon CDK, Avalanche Subnet, Hyperledger Besu, or Ethereum L2 like Arbitrum Orbit).
2. **Hardware Security Modules (HSMs)**: Signer private key managed exclusively inside a FIPS 140-2 Level 3 HSM (AWS KMS / CloudHSM / Google Cloud KMS) with strict role-based multi-signature authorization.
3. **Decentralized Verification**: Verifiers and citizen applications can query the public blockchain RPC directly without requiring access to the TrustGov central backend, ensuring **zero-downtime, tamper-proof verification** even during infrastructure outages.
