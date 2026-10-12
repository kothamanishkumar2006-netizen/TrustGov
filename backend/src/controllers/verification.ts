/**
 * TRUSTGOV - PHASE 6: Verification & Challenge-Response Controllers
 * 
 * Implements:
 * 1. POST /api/verification/challenge (Public: Request Challenge)
 * 2. POST /api/verification/verify-proof (Public: Verify Challenge Signature)
 * 3. POST /api/verification/qr-resolve (Public: Resolve QR Code & Prepare Verification)
 * 4. POST /api/officer/proof/sign (Authenticated Officer: Sign Challenge)
 * 5. GET /api/officer/proof/pending (Authenticated Officer: List Pending Challenges)
 * 6. POST /api/admin/officers/:id/provision-key (Admin: Provision/Rebind Officer Signing Key)
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { challengeService } from '../services/challenge';
import { proofOfPossessionService } from '../services/proofOfPossession';
import { keyProvider } from '../services/keyProvider';
import { logAudit } from '../services/audit';

/**
 * Public: Request a new cryptographic verification challenge for an officer
 * POST /api/verification/challenge
 */
export async function createChallengeHandler(req: Request, res: Response) {
  try {
    const { officerCode, credentialId, officerDid, officerId, audience } = req.body;

    // Resolve officer and DID by any provided identifier
    let officerRes: any;
    if (officerId) {
      officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [officerId]);
    } else if (officerCode) {
      officerRes = await pool.query('SELECT * FROM officers WHERE officer_code = $1', [officerCode]);
    } else if (credentialId) {
      const vcRes = await pool.query('SELECT officer_id FROM verifiable_credentials WHERE credential_id = $1', [credentialId]);
      if (vcRes.rows.length > 0) {
        officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [vcRes.rows[0].officer_id]);
      }
    } else if (officerDid) {
      const didRes = await pool.query('SELECT officer_id FROM did_identities WHERE did = $1', [officerDid]);
      if (didRes.rows.length > 0) {
        officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [didRes.rows[0].officer_id]);
      }
    }

    if (!officerRes || officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: 'No officer matches the provided identifier.' }
      });
    }

    const officer = officerRes.rows[0];

    // Check officer DID
    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [officer.id]);
    if (didRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'OFFICER_DID_REQUIRED', message: 'Officer does not have a registered DID identity.' }
      });
    }

    const didRecord = didRes.rows[0];

    // Generate challenge
    const challenge = await challengeService.createChallenge({
      officerId: officer.id,
      officerDid: didRecord.did,
      audience: audience || 'trustgov-citizen-verifier',
      actorId: (req as AuthenticatedRequest).user?.id || null
    });

    return res.status(201).json({
      success: true,
      message: 'Cryptographic challenge generated successfully',
      data: {
        challengeId: challenge.challenge_id,
        nonce: challenge.nonce,
        officerDid: challenge.officer_did,
        audience: challenge.audience,
        issuedAt: new Date(challenge.issued_at).toISOString(),
        expiresAt: new Date(challenge.expires_at).toISOString(),
        status: challenge.status
      }
    });
  } catch (error: any) {
    console.error('Error generating challenge:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to generate verification challenge' }
    });
  }
}

/**
 * Public: Verify officer proof-of-possession signature
 * POST /api/verification/verify-proof
 */
export async function verifyProofHandler(req: Request, res: Response) {
  try {
    const { challengeId, signature } = req.body;

    if (!challengeId || typeof challengeId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'challengeId is required' }
      });
    }

    if (!signature || typeof signature !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'signature is required' }
      });
    }

    const result = await proofOfPossessionService.verifyProof({
      challengeId,
      signature: signature.trim(),
      actorId: (req as AuthenticatedRequest).user?.id || null
    });

    if (!result.valid) {
      const statusCode = result.code === 'CHALLENGE_ALREADY_USED' ? 409
        : result.code === 'CHALLENGE_NOT_FOUND' ? 404
        : 400;

      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.code || 'VERIFICATION_FAILED',
          message: result.reason || 'Verification checks failed'
        },
        data: result
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Proof of possession verified successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Error verifying proof of possession:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to verify proof of possession' }
    });
  }
}

/**
 * Public: Parse and resolve TrustGov QR payload
 * POST /api/verification/qr-resolve
 */
export async function resolveQRHandler(req: Request, res: Response) {
  try {
    const { qrData, autoChallenge = true, audience } = req.body;

    if (!qrData || typeof qrData !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_QR_PAYLOAD', message: 'qrData string is required' }
      });
    }

    const trimmed = qrData.trim();

    // Check scheme: TRUSTGOV://verify/<credentialId> or TRUSTGOV://verify?credential=<credentialId>
    let credentialId: string | null = null;
    const directMatch = trimmed.match(/^TRUSTGOV:\/\/verify\/([a-zA-Z0-9_-]+)$/i);
    const paramMatch = trimmed.match(/^TRUSTGOV:\/\/verify\?.*credential=([a-zA-Z0-9_-]+)/i);

    if (directMatch) {
      credentialId = directMatch[1];
    } else if (paramMatch) {
      credentialId = paramMatch[1];
    } else {
      await logAudit({
        actorId: null,
        action: 'QR_VERIFICATION_FAILED',
        entityType: 'QR_SCAN',
        entityId: null,
        metadata: { reason: 'UNSUPPORTED_QR_SCHEME' }
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_QR_SCHEME',
          message: 'The scanned QR code is not a valid TrustGov official verification QR code.'
        }
      });
    }

    // Resolve credential from DB
    const vcRes = await pool.query(
      `SELECT vc.*, o.full_name, o.officer_code, o.department, o.designation, o.jurisdiction, o.status as officer_status
       FROM verifiable_credentials vc
       JOIN officers o ON vc.officer_id = o.id
       WHERE vc.credential_id = $1`,
      [credentialId]
    );

    if (vcRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${credentialId}' not found in registry.` }
      });
    }

    const record = vcRes.rows[0];

    // Log audit event
    await logAudit({
      actorId: null,
      action: 'QR_VERIFICATION_STARTED',
      entityType: 'QR_SCAN',
      entityId: credentialId,
      metadata: { credential_id: credentialId, officer_code: record.officer_code }
    });

    // Optionally generate a challenge immediately
    let challengeData: any = null;
    if (autoChallenge) {
      const challenge = await challengeService.createChallenge({
        officerId: record.officer_id,
        officerDid: record.officer_did,
        audience: audience || 'trustgov-citizen-verifier'
      });
      challengeData = {
        challengeId: challenge.challenge_id,
        nonce: challenge.nonce,
        officerDid: challenge.officer_did,
        audience: challenge.audience,
        issuedAt: new Date(challenge.issued_at).toISOString(),
        expiresAt: new Date(challenge.expires_at).toISOString(),
        status: challenge.status
      };
    }

    return res.status(200).json({
      success: true,
      message: 'TrustGov QR code successfully resolved',
      data: {
        credentialId: record.credential_id,
        officerCode: record.officer_code,
        fullName: record.full_name,
        department: record.department,
        designation: record.designation,
        jurisdiction: record.jurisdiction,
        officerDid: record.officer_did,
        officerStatus: record.officer_status,
        credentialStatus: record.status,
        challenge: challengeData
      }
    });
  } catch (error: any) {
    console.error('Error resolving QR code:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to process QR code' }
    });
  }
}

/**
 * Authenticated Officer: Sign an incoming verification challenge
 * POST /api/officer/proof/sign
 */
export async function signProofHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const { challengeId } = req.body;
    if (!challengeId || typeof challengeId !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'challengeId is required' }
      });
    }

    // Lookup officer linked to this user
    const officerRes = await pool.query('SELECT * FROM officers WHERE user_id = $1', [userId]);
    if (officerRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AN_OFFICER', message: 'Authenticated user is not an authorized officer' }
      });
    }

    const officer = officerRes.rows[0];

    // Sign challenge
    const signResult = await proofOfPossessionService.signChallenge({
      officerId: officer.id,
      challengeId: challengeId.trim(),
      actorId: userId
    });

    return res.status(200).json({
      success: true,
      message: 'Challenge signed successfully using secure key custody',
      data: signResult
    });
  } catch (error: any) {
    console.error('Error signing challenge:', error);
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'SIGNING_FAILED',
        message: error.message || 'Failed to sign challenge'
      }
    });
  }
}

/**
 * Authenticated Officer: Retrieve list of pending challenges
 * GET /api/officer/proof/pending
 */
export async function getPendingChallengesHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const officerRes = await pool.query('SELECT * FROM officers WHERE user_id = $1', [userId]);
    if (officerRes.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AN_OFFICER', message: 'Authenticated user is not an officer' }
      });
    }

    const officer = officerRes.rows[0];
    const pending = await challengeService.getPendingChallengesForOfficer(officer.id);

    return res.status(200).json({
      success: true,
      data: {
        challenges: pending.map((c: any) => ({
          challengeId: c.challenge_id,
          audience: c.audience,
          issuedAt: c.issued_at,
          expiresAt: c.expires_at
        }))
      }
    });
  } catch (error: any) {
    console.error('Error retrieving pending challenges:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve pending challenges' }
    });
  }
}

/**
 * Admin: Re-provision / rebind signing key for an officer
 * POST /api/admin/officers/:id/provision-key
 */
export async function provisionKeyHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer '${id}' not found` }
      });
    }

    const officer = officerRes.rows[0];

    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [officer.id]);
    if (didRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'DID_NOT_FOUND', message: 'Officer must have a DID issued before provisioning a signing key' }
      });
    }

    const didRecord = didRes.rows[0];

    // Rebind key in KeyProvider
    const rebind = await keyProvider.rebindKey(officer.id, didRecord.did);

    // Update public key on did_identities
    await pool.query(
      'UPDATE did_identities SET public_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [rebind.publicKeyMultibase, didRecord.id]
    );

    // Keep officers table in sync
    await pool.query(
      'UPDATE officers SET public_key = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [rebind.publicKeyMultibase, officer.id]
    );

    // Audit log
    await logAudit({
      actorId: req.user?.id || null,
      action: 'KEY_PROVISIONED',
      entityType: 'SIGNING_KEY',
      entityId: officer.id,
      metadata: {
        officer_id: officer.id,
        officer_did: didRecord.did,
        key_type: 'Ed25519'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Officer signing key provisioned successfully in secure key custody',
      data: {
        officerId: officer.id,
        did: didRecord.did,
        publicKeyMultibase: rebind.publicKeyMultibase,
        keyType: 'Ed25519'
      }
    });
  } catch (error: any) {
    console.error('Error provisioning signing key:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to provision signing key' }
    });
  }
}
