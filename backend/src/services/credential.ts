/**
 * TRUSTGOV - PHASE 4: Verifiable Credential Service
 * 
 * Implements:
 * 1. Deterministic canonicalization (RFC 8785 aligned)
 * 2. Credential structure generation
 * 3. Cryptographic signing with Issuer Ed25519 key
 * 4. Cryptographic verification & tamper detection
 */

import crypto from 'crypto';
import { verifySignature } from './crypto';
import { issuerAuthority, ISSUER_DID, ISSUER_KEY_ID } from './issuer';

/**
 * Deterministic JSON Canonicalizer
 * Recursively sorts keys alphabetically to ensure consistent cryptographic hashing & signing.
 */
export function canonicalize(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

export interface CredentialSubject {
  id: string; // Officer DID
  officerCode: string;
  fullName: string;
  department: string;
  designation: string;
  jurisdiction: string;
  officialEmail?: string;
}

export interface CredentialProof {
  type: string;
  created: string;
  verificationMethod: string;
  proofPurpose: string;
  proofValue: string;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: CredentialSubject;
  proof: CredentialProof;
}

export interface IssueCredentialParams {
  officerId: string;
  officerCode: string;
  fullName: string;
  department: string;
  designation: string;
  jurisdiction: string;
  officialEmail?: string;
  officerDid: string;
  validityDays?: number;
}

/**
 * Creates and cryptographically signs a Verifiable Credential for an officer.
 */
export function createAndSignCredential(params: IssueCredentialParams): {
  credential: VerifiableCredential;
  canonicalPayload: string;
  credentialId: string;
  issuedAt: Date;
  validFrom: Date;
  validUntil: Date;
} {
  const credentialUuid = crypto.randomUUID();
  const credentialId = `VC-TG-${params.officerCode}-${credentialUuid.slice(0, 8).toUpperCase()}`;
  const urnId = `urn:uuid:${credentialUuid}`;

  const now = new Date();
  const validUntil = new Date(now.getTime() + (params.validityDays || 365) * 24 * 60 * 60 * 1000);

  const subject: CredentialSubject = {
    id: params.officerDid,
    officerCode: params.officerCode,
    fullName: params.fullName,
    department: params.department,
    designation: params.designation,
    jurisdiction: params.jurisdiction,
    ...(params.officialEmail ? { officialEmail: params.officialEmail } : {})
  };

  // Unsigned payload
  const unsignedPayload = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1'
    ],
    id: urnId,
    type: [
      'VerifiableCredential',
      'GovernmentOfficerCredential'
    ],
    issuer: ISSUER_DID,
    issuanceDate: now.toISOString(),
    validFrom: now.toISOString(),
    validUntil: validUntil.toISOString(),
    credentialSubject: subject
  };

  // Canonicalize unsigned payload
  const canonicalPayload = canonicalize(unsignedPayload);

  // Sign canonical payload using Issuer Ed25519 private key
  const signatureHex = issuerAuthority.signPayload(canonicalPayload);

  const proof: CredentialProof = {
    type: 'Ed25519Signature2020',
    created: now.toISOString(),
    verificationMethod: ISSUER_KEY_ID,
    proofPurpose: 'assertionMethod',
    proofValue: signatureHex
  };

  const credential: VerifiableCredential = {
    ...unsignedPayload,
    proof
  };

  return {
    credential,
    canonicalPayload,
    credentialId,
    issuedAt: now,
    validFrom: now,
    validUntil
  };
}

/**
 * Verifies the cryptographic signature of a credential payload against the issuer's public key.
 * Detects any tampering in claims, dates, DIDs, or proof value.
 */
/**
 * Verifies the cryptographic signature of a credential payload against the issuer's public key.
 * Detects any tampering in claims, dates, DIDs, or proof value.
 */
export function verifyCredentialSignature(
  credential: VerifiableCredential | any,
  issuerPublicKeyMultibase: string = issuerAuthority.getPublicKeyMultibase()
): boolean {
  try {
    if (!credential || !credential.proof || !credential.proof.proofValue) {
      return false;
    }

    // Extract proof and reconstruct exact unsigned payload
    const { proof, ...unsignedPayload } = credential;
    const canonicalPayload = canonicalize(unsignedPayload);

    return verifySignature(canonicalPayload, proof.proofValue, issuerPublicKeyMultibase);
  } catch (err) {
    return false;
  }
}

export interface VerificationResult {
  valid: boolean;
  credentialId: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';
  issuer: string;
  subject: string;
  signatureValid: boolean;
  subjectValid: boolean;
  issuerValid: boolean;
  notRevoked: boolean;
  notSuspended: boolean;
  notExpired: boolean;
  officerStatusValid: boolean;
  checks?: {
    signatureValid: boolean;
    issuerValid: boolean;
    subjectValid: boolean;
    statusValid: boolean;
    datesValid: boolean;
    officerActive: boolean;
  };
  reason?: string;
  verificationTimestamp: string;
}

/**
 * Performs full validation of a Verifiable Credential against:
 * 1. Cryptographic Ed25519 signature & tamper check
 * 2. Issuer validity
 * 3. Subject DID validity
 * 4. Credential status (ACTIVE, SUSPENDED, REVOKED)
 * 5. Expiration time
 * 6. Officer status cascade
 */
export function evaluateCredentialValidity(
  credentialOrRecord: any,
  officerRecordOrStatus?: any,
  issuerPublicKeyMultibase: string = issuerAuthority.getPublicKeyMultibase()
): VerificationResult {
  const timestamp = new Date().toISOString();

  // Extract payload and record details
  const payload = credentialOrRecord.credential_payload
    ? (typeof credentialOrRecord.credential_payload === 'string'
        ? JSON.parse(credentialOrRecord.credential_payload)
        : credentialOrRecord.credential_payload)
    : credentialOrRecord;

  const credentialId = credentialOrRecord.credential_id || payload.id;
  const credentialStatus = credentialOrRecord.status || 'ACTIVE';

  // Normalize officer details
  let officerStatus = 'ACTIVE';
  let officerDid = credentialOrRecord.officer_did || payload.credentialSubject?.id;

  if (typeof officerRecordOrStatus === 'string') {
    officerStatus = officerRecordOrStatus;
  } else if (officerRecordOrStatus && typeof officerRecordOrStatus === 'object') {
    officerStatus = officerRecordOrStatus.status || 'ACTIVE';
    if (officerRecordOrStatus.did) {
      officerDid = officerRecordOrStatus.did;
    }
  } else if (credentialOrRecord.officer_status) {
    officerStatus = credentialOrRecord.officer_status;
  }

  // 1. Signature & Tamper Verification
  const signatureValid = verifyCredentialSignature(payload, issuerPublicKeyMultibase);

  // 2. Issuer DID check
  const issuerValid = (payload.issuer === ISSUER_DID);

  // 3. Subject DID check
  const subjectDid = payload.credentialSubject?.id;
  const subjectValid = !!subjectDid && (!officerDid || subjectDid === officerDid);

  // 4. Status checks
  const notRevoked = (credentialStatus !== 'REVOKED');
  const notSuspended = (credentialStatus !== 'SUSPENDED');

  // 5. Expiration check
  let notExpired = true;
  if (credentialOrRecord.valid_until) {
    notExpired = new Date(credentialOrRecord.valid_until) > new Date();
  } else if (payload.validUntil) {
    notExpired = new Date(payload.validUntil) > new Date();
  }

  // 6. Officer status cascade check
  const officerStatusValid = (officerStatus === 'ACTIVE');

  let valid = true;
  let reason: string | undefined = undefined;

  if (!signatureValid) {
    valid = false;
    reason = 'INVALID_SIGNATURE';
  } else if (!issuerValid) {
    valid = false;
    reason = 'INVALID_ISSUER';
  } else if (!subjectValid) {
    valid = false;
    reason = 'INVALID_SUBJECT';
  } else if (!notRevoked) {
    valid = false;
    reason = 'CREDENTIAL_REVOKED';
  } else if (!notSuspended) {
    valid = false;
    reason = 'CREDENTIAL_SUSPENDED';
  } else if (!notExpired) {
    valid = false;
    reason = 'CREDENTIAL_EXPIRED';
  } else if (officerStatus === 'REVOKED') {
    valid = false;
    reason = 'OFFICER_REVOKED';
  } else if (officerStatus === 'SUSPENDED') {
    valid = false;
    reason = 'OFFICER_SUSPENDED';
  }

  const effectiveStatus = !notExpired ? 'EXPIRED' : credentialStatus;

  return {
    valid,
    credentialId,
    status: effectiveStatus,
    issuer: payload.issuer,
    subject: subjectDid,
    signatureValid,
    subjectValid,
    issuerValid,
    notRevoked,
    notSuspended,
    notExpired,
    officerStatusValid,
    checks: {
      signatureValid,
      issuerValid,
      subjectValid,
      statusValid: notRevoked && notSuspended,
      datesValid: notExpired,
      officerActive: officerStatusValid
    },
    reason,
    verificationTimestamp: timestamp
  };
}
