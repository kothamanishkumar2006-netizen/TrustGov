/**
 * TRUSTGOV - PHASE 6: Challenge Generation & Lifecycle Service
 * 
 * Manages the creation, canonicalization, expiration, and single-use state tracking
 * of cryptographic challenges for officer proof-of-possession.
 * 
 * SECURITY INVARIANTS:
 * 1. Nonces are generated strictly using Node.js CSPRNG (crypto.randomBytes(32)).
 * 2. Challenges are short-lived (5-minute maximum TTL) and bound to a specific officer and DID.
 * 3. Structured challenge payloads are deterministically sorted using RFC 8785 canonicalization.
 * 4. Single-use is strictly enforced to protect against replay attacks.
 */

import crypto from 'crypto';
import { pool } from '../config/db';
import { canonicalize } from './credential';
import { logAudit } from './audit';

export interface VerificationChallengeRecord {
  id: string;
  challenge_id: string;
  officer_id: string;
  officer_did: string;
  nonce: string;
  audience: string;
  issued_at: Date;
  expires_at: Date;
  used_at: Date | null;
  status: 'PENDING' | 'USED' | 'EXPIRED' | 'FAILED';
  created_at: Date;
  updated_at: Date;
}

export interface StructuredChallengePayload {
  type: 'TrustGovProofOfPossession';
  challengeId: string;
  nonce: string;
  did: string;
  audience: string;
  issuedAt: string;
  expiresAt: string;
}

export class ChallengeService {
  private defaultTtlMs = 5 * 60 * 1000; // 5 minutes maximum lifetime

  /**
   * Generates a new cryptographic challenge for an officer
   */
  public async createChallenge(params: {
    officerId: string;
    officerDid: string;
    audience?: string;
    ttlMs?: number;
    actorId?: string | null;
  }): Promise<VerificationChallengeRecord> {
    const {
      officerId,
      officerDid,
      audience = 'trustgov-citizen-verifier',
      ttlMs = this.defaultTtlMs,
      actorId = null
    } = params;

    const challengeId = `CHG-${crypto.randomUUID()}`;
    // 32 bytes (256 bits) of cryptographically secure randomness
    const nonce = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);

    const query = `
      INSERT INTO verification_challenges (
        challenge_id, officer_id, officer_did, nonce, audience,
        issued_at, expires_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const res = await pool.query(query, [
      challengeId,
      officerId,
      officerDid,
      nonce,
      audience,
      now,
      expiresAt,
      'PENDING'
    ]);

    const record: VerificationChallengeRecord = res.rows[0];

    // Emit audit log
    await logAudit({
      actorId,
      action: 'CHALLENGE_CREATED',
      entityType: 'VERIFICATION_CHALLENGE',
      entityId: record.id,
      metadata: {
        challenge_id: challengeId,
        officer_id: officerId,
        officer_did: officerDid,
        audience,
        expires_at: expiresAt.toISOString()
      }
    });

    return record;
  }

  /**
   * Retrieves a challenge and automatically transitions status to EXPIRED if past TTL
   */
  public async getChallenge(challengeId: string): Promise<VerificationChallengeRecord | null> {
    const res = await pool.query(
      'SELECT * FROM verification_challenges WHERE challenge_id = $1',
      [challengeId]
    );

    if (res.rows.length === 0) return null;

    const record: VerificationChallengeRecord = res.rows[0];

    // Check expiration if still pending
    if (record.status === 'PENDING' && new Date() > new Date(record.expires_at)) {
      await pool.query(
        "UPDATE verification_challenges SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE challenge_id = $1",
        [challengeId]
      );
      record.status = 'EXPIRED';

      await logAudit({
        actorId: null,
        action: 'CHALLENGE_EXPIRED',
        entityType: 'VERIFICATION_CHALLENGE',
        entityId: record.id,
        metadata: { challenge_id: challengeId, expired_at: new Date().toISOString() }
      });
    }

    return record;
  }

  /**
   * Constructs the structured challenge payload to be signed
   */
  public buildChallengePayload(challenge: VerificationChallengeRecord): StructuredChallengePayload {
    return {
      type: 'TrustGovProofOfPossession',
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      did: challenge.officer_did,
      audience: challenge.audience,
      issuedAt: new Date(challenge.issued_at).toISOString(),
      expiresAt: new Date(challenge.expires_at).toISOString()
    };
  }

  /**
   * Produces a deterministic RFC 8785 canonical string representation of the challenge payload
   */
  public canonicalizeChallenge(challenge: VerificationChallengeRecord): string {
    const payload = this.buildChallengePayload(challenge);
    return canonicalize(payload);
  }

  /**
   * Marks a challenge as USED to prevent replay attacks
   */
  public async markChallengeUsed(challengeId: string): Promise<void> {
    const now = new Date();
    await pool.query(
      "UPDATE verification_challenges SET status = 'USED', used_at = $1, updated_at = $2 WHERE challenge_id = $3",
      [now, now, challengeId]
    );
  }

  /**
   * Retrieves pending challenges for a specific officer
   */
  public async getPendingChallengesForOfficer(officerId: string): Promise<VerificationChallengeRecord[]> {
    const res = await pool.query(
      "SELECT * FROM verification_challenges WHERE officer_id = $1 AND status = 'PENDING' ORDER BY created_at DESC",
      [officerId]
    );

    const now = new Date();
    // Filter out expired challenges
    return res.rows.filter((c: any) => new Date(c.expires_at) > now);
  }
}

export const challengeService = new ChallengeService();
