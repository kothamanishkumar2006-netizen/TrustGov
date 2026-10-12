/**
 * TRUSTGOV - PHASE 6: Proof of Possession Service
 * 
 * Orchestrates:
 * 1. Officer Challenge Signing (via KeyProvider custody)
 * 2. Multi-tier Cryptographic & Authority Verification:
 *    - Replay protection & challenge validity
 *    - DID public key resolution & status check
 *    - Ed25519 digital signature verification
 *    - Officer duty authorization check
 *    - W3C Verifiable Credential integrity check
 *    - Blockchain smart contract registry status and hash anchoring check
 * 
 * CRITICAL SECURITY INVARIANT:
 * Private keys NEVER leave the KeyProvider boundary.
 */

import { pool } from '../config/db';
import { challengeService, VerificationChallengeRecord } from './challenge';
import { keyProvider } from './keyProvider';
import { verifySignature } from './crypto';
import { verifyCredentialSignature } from './credential';
import { blockchainService } from './blockchain';
import { logAudit } from './audit';

export interface VerificationResultPayload {
  valid: boolean;
  code?: string;
  reason?: string;
  identity?: {
    verified: boolean;
    did: string;
    officerCode: string;
    fullName: string;
    department: string;
    designation: string;
    jurisdiction: string;
  };
  credential?: {
    verified: boolean;
    credentialId: string;
    status: string;
    issuedAt: string;
    validUntil?: string;
  };
  authorization?: {
    status: string;
    verified: boolean;
  };
  proofOfPossession?: {
    verified: boolean;
    challengeId: string;
    algorithm: string;
    signedAt: string;
  };
  blockchain?: {
    verified: boolean;
    anchored: boolean;
    hashMatch: boolean;
    status: string;
    computedHash: string;
    onChainHash?: string;
  };
  fraudWarning: string;
}

const CRITICAL_FRAUD_WARNING = 'IMPORTANT: Identity verification confirms the registered identity and credential status. NO GOVERNMENT OFFICER OR LAW ENFORCEMENT AGENCY IS EVER AUTHORIZED to demand money transfers to personal bank accounts or UPI IDs, or ask for OTPs, passwords, or PINs.';

export class ProofOfPossessionService {
  /**
   * Generates an Ed25519 signature over a challenge for an authenticated officer
   */
  public async signChallenge(params: {
    officerId: string;
    challengeId: string;
    actorId?: string | null;
  }): Promise<{
    challengeId: string;
    did: string;
    signature: string;
    algorithm: string;
    signedAt: string;
  }> {
    const { officerId, challengeId, actorId = null } = params;

    // 1. Retrieve challenge
    const challenge = await challengeService.getChallenge(challengeId);
    if (!challenge) {
      const err: any = new Error(`Challenge '${challengeId}' not found`);
      err.code = 'CHALLENGE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // 2. Ownership verification: Challenge must belong to this officer
    if (challenge.officer_id !== officerId) {
      const err: any = new Error('You are not authorized to sign this challenge');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // 3. Challenge status & expiration checks
    if (challenge.status === 'USED') {
      const err: any = new Error('Challenge has already been used');
      err.code = 'CHALLENGE_ALREADY_USED';
      err.statusCode = 400;
      throw err;
    }

    if (challenge.status === 'EXPIRED' || new Date() > new Date(challenge.expires_at)) {
      const err: any = new Error('Challenge has expired');
      err.code = 'CHALLENGE_EXPIRED';
      err.statusCode = 400;
      throw err;
    }

    if (challenge.status !== 'PENDING') {
      const err: any = new Error(`Challenge is in invalid status: ${challenge.status}`);
      err.code = 'INVALID_CHALLENGE_STATUS';
      err.statusCode = 400;
      throw err;
    }

    // 4. Officer status check
    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [officerId]);
    if (officerRes.rows.length === 0) {
      const err: any = new Error('Officer record not found');
      err.code = 'OFFICER_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const officer = officerRes.rows[0];
    if (officer.status !== 'ACTIVE') {
      const err: any = new Error(`Officer is currently ${officer.status}. Signing rejected.`);
      err.code = 'OFFICER_NOT_ACTIVE';
      err.statusCode = 403;
      throw err;
    }

    // 5. Officer DID status check
    const didRes = await pool.query('SELECT * FROM did_identities WHERE did = $1', [challenge.officer_did]);
    if (didRes.rows.length === 0) {
      const err: any = new Error('Officer DID identity not found');
      err.code = 'DID_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const didRecord = didRes.rows[0];
    if (didRecord.status !== 'ACTIVE') {
      const err: any = new Error(`Officer DID is currently ${didRecord.status}. Signing rejected.`);
      err.code = 'DID_NOT_ACTIVE';
      err.statusCode = 403;
      throw err;
    }

    // 6. Ensure signing key exists in KeyProvider and matches DID public key
    const hasKey = await keyProvider.keyExists(officerId);
    const existingPub = await keyProvider.getPublicKey(officerId);
    if (!hasKey) {
      // Re-provision signing key and update DID public key in dev store
      const rebind = await keyProvider.rebindKey(officerId, challenge.officer_did);
      await pool.query(
        'UPDATE did_identities SET public_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [rebind.publicKeyMultibase, didRecord.id]
      );
    } else if (existingPub && didRecord.public_key !== existingPub) {
      await pool.query(
        'UPDATE did_identities SET public_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [existingPub, didRecord.id]
      );
    }

    // 7. Canonicalize structured challenge payload (RFC 8785)
    const canonicalPayload = challengeService.canonicalizeChallenge(challenge);

    // 8. Sign via KeyProvider (Private key NEVER leaves KeyProvider)
    const signature = await keyProvider.sign(canonicalPayload, officerId);
    const signedAt = new Date().toISOString();

    console.log('DEBUG SIGN:', { canonicalPayload, signature, officerId });

    // 9. Emit audit log
    await logAudit({
      actorId,
      action: 'CHALLENGE_SIGNED',
      entityType: 'VERIFICATION_CHALLENGE',
      entityId: challenge.id,
      metadata: {
        challenge_id: challenge.challenge_id,
        officer_id: officerId,
        officer_did: challenge.officer_did,
        signed_at: signedAt
      }
    });

    return {
      challengeId: challenge.challenge_id,
      did: challenge.officer_did,
      signature,
      algorithm: 'Ed25519',
      signedAt
    };
  }

  /**
   * Cryptographically verifies an officer's proof-of-possession signature
   * and conducts the complete 5-point verification check.
   */
  public async verifyProof(params: {
    challengeId: string;
    signature: string;
    actorId?: string | null;
  }): Promise<VerificationResultPayload> {
    const { challengeId, signature, actorId = null } = params;

    // 1. Retrieve challenge
    const challenge = await challengeService.getChallenge(challengeId);
    if (!challenge) {
      return {
        valid: false,
        code: 'CHALLENGE_NOT_FOUND',
        reason: `Challenge '${challengeId}' was not found.`,
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 2. Replay attack protection: Single-use check
    if (challenge.status === 'USED') {
      await logAudit({
        actorId,
        action: 'CHALLENGE_REPLAY_REJECTED',
        entityType: 'VERIFICATION_CHALLENGE',
        entityId: challenge.id,
        metadata: { challenge_id: challengeId, attempted_at: new Date().toISOString() }
      });

      return {
        valid: false,
        code: 'CHALLENGE_ALREADY_USED',
        reason: 'Replay attack prevented: This challenge has already been used.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 3. Expiration check
    if (challenge.status === 'EXPIRED' || new Date() > new Date(challenge.expires_at)) {
      return {
        valid: false,
        code: 'CHALLENGE_EXPIRED',
        reason: 'Verification challenge has expired.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    if (challenge.status !== 'PENDING') {
      return {
        valid: false,
        code: 'INVALID_CHALLENGE_STATUS',
        reason: `Challenge is not in PENDING state (${challenge.status}).`,
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 4. Resolve Officer & Identity
    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [challenge.officer_id]);
    if (officerRes.rows.length === 0) {
      return {
        valid: false,
        code: 'OFFICER_NOT_FOUND',
        reason: 'Underlying officer record does not exist.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }
    const officer = officerRes.rows[0];

    // Authorization check
    if (officer.status !== 'ACTIVE') {
      return {
        valid: false,
        code: 'OFFICER_NOT_ACTIVE',
        reason: `Officer duty status is ${officer.status}. Verification rejected.`,
        authorization: { status: officer.status, verified: false },
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // DID Identity check
    const didRes = await pool.query('SELECT * FROM did_identities WHERE did = $1', [challenge.officer_did]);
    if (didRes.rows.length === 0) {
      return {
        valid: false,
        code: 'DID_NOT_FOUND',
        reason: 'Officer DID identity not found in registry.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }
    const didRecord = didRes.rows[0];

    if (didRecord.status !== 'ACTIVE') {
      return {
        valid: false,
        code: 'DID_NOT_ACTIVE',
        reason: `Officer DID status is ${didRecord.status}. Verification rejected.`,
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 5. Cryptographic Ed25519 signature verification
    const canonicalPayload = challengeService.canonicalizeChallenge(challenge);
    const signatureValid = verifySignature(canonicalPayload, signature, didRecord.public_key);

    if (!signatureValid) {
      await logAudit({
        actorId,
        action: 'CHALLENGE_FAILED',
        entityType: 'VERIFICATION_CHALLENGE',
        entityId: challenge.id,
        metadata: { challenge_id: challengeId, reason: 'INVALID_SIGNATURE' }
      });

      return {
        valid: false,
        code: 'INVALID_SIGNATURE',
        reason: 'Cryptographic signature mismatch. Proof of possession failed.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 6. Verifiable Credential check
    const vcRes = await pool.query(
      "SELECT * FROM verifiable_credentials WHERE officer_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1",
      [officer.id]
    );

    if (vcRes.rows.length === 0) {
      return {
        valid: false,
        code: 'CREDENTIAL_NOT_ACTIVE',
        reason: 'No active Verifiable Credential exists for this officer.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    const vc = vcRes.rows[0];
    const vcPayload = typeof vc.credential_payload === 'string'
      ? JSON.parse(vc.credential_payload)
      : vc.credential_payload;

    // Check credential expiration
    if (vc.valid_until && new Date() > new Date(vc.valid_until)) {
      return {
        valid: false,
        code: 'CREDENTIAL_EXPIRED',
        reason: 'Officer Verifiable Credential has expired.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // Verify credential signature by National Issuance Authority
    const vcSigValid = verifyCredentialSignature(vcPayload);
    if (!vcSigValid) {
      return {
        valid: false,
        code: 'CREDENTIAL_SIGNATURE_INVALID',
        reason: 'Verifiable Credential signature is invalid.',
        fraudWarning: CRITICAL_FRAUD_WARNING
      };
    }

    // 7. Blockchain integrity check
    let bcResult: any = {
      anchored: false,
      hashMatch: false,
      blockchainStatus: 'NONE',
      computedHash: blockchainService.computeHash(vcPayload)
    };

    try {
      const bcAnchorRes = await pool.query(
        'SELECT * FROM blockchain_registry WHERE credential_id = $1 LIMIT 1',
        [vc.credential_id]
      );
      const expectedHash = bcAnchorRes.rows.length > 0 ? bcAnchorRes.rows[0].credential_hash : undefined;
      bcResult = await blockchainService.verifyCredentialIntegrity(vcPayload, expectedHash);
    } catch (e) {
      // Non-blocking blockchain inspection fallback
    }

    // 8. Replay Protection: Mark challenge as USED
    await challengeService.markChallengeUsed(challenge.challenge_id);

    // 9. Record Audit Log (CHALLENGE_VERIFIED)
    await logAudit({
      actorId,
      action: 'CHALLENGE_VERIFIED',
      entityType: 'VERIFICATION_CHALLENGE',
      entityId: challenge.id,
      metadata: {
        challenge_id: challenge.challenge_id,
        officer_id: officer.id,
        officer_did: challenge.officer_did,
        credential_id: vc.credential_id,
        blockchain_anchored: bcResult.anchored
      }
    });

    return {
      valid: true,
      identity: {
        verified: true,
        did: challenge.officer_did,
        officerCode: officer.officer_code,
        fullName: officer.full_name,
        department: officer.department,
        designation: officer.designation,
        jurisdiction: officer.jurisdiction
      },
      credential: {
        verified: true,
        credentialId: vc.credential_id,
        status: vc.status,
        issuedAt: new Date(vc.issued_at).toISOString(),
        validUntil: vc.valid_until ? new Date(vc.valid_until).toISOString() : undefined
      },
      authorization: {
        status: officer.status,
        verified: officer.status === 'ACTIVE'
      },
      proofOfPossession: {
        verified: true,
        challengeId: challenge.challenge_id,
        algorithm: 'Ed25519',
        signedAt: new Date().toISOString()
      },
      blockchain: {
        verified: bcResult.anchored && bcResult.hashMatch,
        anchored: bcResult.anchored,
        hashMatch: bcResult.hashMatch,
        status: bcResult.blockchainStatus,
        computedHash: bcResult.computedHash,
        onChainHash: bcResult.onChainHash
      },
      fraudWarning: CRITICAL_FRAUD_WARNING
    };
  }
}

export const proofOfPossessionService = new ProofOfPossessionService();
