/**
 * TRUSTGOV - PHASE 4: Credential Issuer Authority Service
 * 
 * Manages the authorized TrustGov Credential Issuance Authority identity:
 * - Authority DID: did:trustgov:a0000000-0000-4000-8000-000000000001
 * - Cryptographic Algorithm: Ed25519
 * 
 * CRITICAL SECURITY ARCHITECTURE:
 * The issuer private key is held strictly in-memory by this provider abstraction.
 * It is NEVER stored in PostgreSQL, NEVER returned in any API response,
 * NEVER exposed to the frontend, NEVER logged, and NEVER committed to Git.
 * 
 * PRODUCTION DISCLAIMER:
 * In a production deployment, this key-provider is backed by a Hardware Security Module (HSM)
 * or Cloud KMS (e.g., AWS CloudHSM, Google Cloud KMS, Azure Key Vault).
 */

import { generateEd25519KeyPair, signMessage, DIDDocument } from './crypto';

// Fixed prototype DID for TrustGov National Issuance Authority
export const ISSUER_DID = 'did:trustgov:a0000000-0000-4000-8000-000000000001';
export const ISSUER_KEY_ID = `${ISSUER_DID}#key-1`;
export const ISSUER_NAME = 'TrustGov National Credential Issuance Authority';

class IssuerAuthority {
  private did: string = ISSUER_DID;
  private keyId: string = ISSUER_KEY_ID;
  private publicKeyMultibase: string;
  private publicKeyPem: string;
  private privateKeyPem: string;

  constructor() {
    // Generate isolated Ed25519 keypair for prototype authority
    const kp = generateEd25519KeyPair();
    this.publicKeyMultibase = kp.publicKeyMultibase;
    this.publicKeyPem = kp.publicKeyPem;
    this.privateKeyPem = kp.privateKeyPem;
  }

  public getDID(): string {
    return this.did;
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public getPublicKeyMultibase(): string {
    return this.publicKeyMultibase;
  }

  public getPublicKeyPem(): string {
    return this.publicKeyPem;
  }

  public getDIDDocument(): DIDDocument {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ],
      id: this.did,
      verificationMethod: [
        {
          id: this.keyId,
          type: 'Ed25519VerificationKey2020',
          controller: this.did,
          publicKeyMultibase: this.publicKeyMultibase
        }
      ],
      authentication: [this.keyId],
      assertionMethod: [this.keyId],
      status: 'ACTIVE',
      metadata: {
        method: 'did:trustgov',
        isPrototype: true,
        disclaimer: 'Prototype TrustGov Issuer Authority. Production requires HSM/KMS secure key custody.',
        keyType: 'Ed25519'
      }
    };
  }

  /**
   * Signs a canonical credential payload string using the issuer's Ed25519 private key.
   * Private key material never leaves this method scope.
   */
  public signPayload(canonicalPayload: string): string {
    return signMessage(canonicalPayload, this.privateKeyPem);
  }
}

// Singleton issuer authority instance
export const issuerAuthority = new IssuerAuthority();
