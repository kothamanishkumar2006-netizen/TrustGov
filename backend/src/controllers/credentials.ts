/**
 * TRUSTGOV - PHASE 4: Verifiable Credentials (VC) Controllers
 * 
 * Implements:
 * 1. POST /api/admin/officers/:id/credentials (Issue Verifiable Credential)
 * 2. GET /api/admin/officers/:id/credentials (Get Officer Credentials - Admin)
 * 3. GET /api/officer/credentials (Get My Credentials - Officer)
 * 4. GET /api/credentials/:credentialId (Public Credential Retrieval)
 * 5. GET /api/credentials/:credentialId/verify (Public Cryptographic Verification)
 * 6. POST /api/credentials/verify (Direct Payload Verification)
 * 7. PATCH /api/admin/credentials/:id/status (Admin Credential Status Lifecycle)
 * 
 * CRITICAL SECURITY:
 * Private keys are NEVER stored in the database, NEVER returned in API responses,
 * NEVER printed in logs, and NEVER exposed in credentials.
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import {
  createAndSignCredential,
  verifyCredentialSignature,
  evaluateCredentialValidity
} from '../services/credential';
import { ISSUER_DID } from '../services/issuer';

/**
 * Admin: Issue a new cryptographically verifiable credential for an officer
 * POST /api/admin/officers/:id/credentials
 */
export async function issueCredential(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { validityDays = 365 } = req.body;

    // 1. Check if officer exists
    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID '${id}' not found` }
      });
    }

    const officer = officerRes.rows[0];

    // 2. Cannot issue credential to a revoked officer
    if (officer.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        error: { code: 'OFFICER_REVOKED', message: 'Cannot issue a Verifiable Credential to a revoked officer' }
      });
    }

    // 3. Officer MUST have an issued DID
    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [id]);
    if (didRes.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OFFICER_DID_REQUIRED',
          message: 'Officer must have an issued DID identity before a Verifiable Credential can be generated.'
        }
      });
    }
    const officerDid = didRes.rows[0].did;

    // 4. Strict 1:1 Rule: Check if officer already has an ACTIVE credential
    const activeCredRes = await pool.query(
      "SELECT * FROM verifiable_credentials WHERE officer_id = $1 AND status = 'ACTIVE'",
      [id]
    );
    if (activeCredRes.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CREDENTIAL_ALREADY_EXISTS',
          message: 'Officer already has an active Verifiable Credential. Revoke or suspend the existing credential before issuing a new one.'
        }
      });
    }

    // 5. Generate and sign credential via Issuer Authority
    const { credential, credentialId, issuedAt, validFrom, validUntil } = createAndSignCredential({
      officerId: officer.id,
      officerCode: officer.officer_code,
      fullName: officer.full_name,
      department: officer.department,
      designation: officer.designation,
      jurisdiction: officer.jurisdiction,
      officialEmail: officer.official_email,
      officerDid,
      validityDays: Number(validityDays) || 365
    });

    // 6. Persist to verifiable_credentials table
    const insertQuery = `
      INSERT INTO verifiable_credentials (
        credential_id, officer_id, officer_did, issuer_did,
        credential_type, credential_subject, credential_payload, proof,
        status, issued_at, valid_from, valid_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const insertRes = await pool.query(insertQuery, [
      credentialId,
      officer.id,
      officerDid,
      ISSUER_DID,
      'GovernmentOfficerCredential',
      JSON.stringify(credential.credentialSubject),
      JSON.stringify(credential),
      JSON.stringify(credential.proof),
      'ACTIVE',
      issuedAt,
      validFrom,
      validUntil
    ]);

    const storedCredential = insertRes.rows[0];

    // 7. Record Audit Log (CREDENTIAL_ISSUED)
    await logAudit({
      actorId: req.user?.id || null,
      action: 'CREDENTIAL_ISSUED',
      entityType: 'VERIFIABLE_CREDENTIAL',
      entityId: storedCredential.id,
      metadata: {
        credential_id: credentialId,
        officer_id: officer.id,
        officer_code: officer.officer_code,
        officer_did: officerDid,
        issuer_did: ISSUER_DID,
        valid_until: validUntil
      }
    });

    // 8. Return response
    return res.status(201).json({
      success: true,
      message: 'Verifiable Credential issued successfully',
      data: {
        credentialId: storedCredential.credential_id,
        status: storedCredential.status,
        issuedAt: storedCredential.issued_at,
        validFrom: storedCredential.valid_from,
        validUntil: storedCredential.valid_until,
        credential
      }
    });
  } catch (error) {
    console.error('Error issuing credential:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to issue Verifiable Credential' }
    });
  }
}

/**
 * Admin: Get all credentials for a specific officer
 * GET /api/admin/officers/:id/credentials
 */
export async function getOfficerCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check officer exists
    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID '${id}' not found` }
      });
    }

    const credsRes = await pool.query(
      'SELECT * FROM verifiable_credentials WHERE officer_id = $1 ORDER BY created_at DESC',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        officerId: id,
        credentials: credsRes.rows.map((c: any) => ({
          id: c.id,
          credentialId: c.credential_id,
          officerDid: c.officer_did,
          issuerDid: c.issuer_did,
          credentialType: c.credential_type,
          status: c.status,
          issuedAt: c.issued_at,
          validFrom: c.valid_from,
          validUntil: c.valid_until,
          suspendedAt: c.suspended_at,
          revokedAt: c.revoked_at,
          credential: typeof c.credential_payload === 'string' ? JSON.parse(c.credential_payload) : c.credential_payload
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching officer credentials:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch credentials' }
    });
  }
}

/**
 * Officer: Get credentials belonging to the logged-in officer
 * GET /api/officer/credentials
 */
export async function getMyCredentials(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    // Find officer associated with user_id
    const officerRes = await pool.query('SELECT * FROM officers WHERE user_id = $1', [userId]);
    if (officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: 'No officer profile associated with this account' }
      });
    }

    const officer = officerRes.rows[0];
    const credsRes = await pool.query(
      'SELECT * FROM verifiable_credentials WHERE officer_id = $1 ORDER BY created_at DESC',
      [officer.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        officer: {
          id: officer.id,
          officerCode: officer.officer_code,
          fullName: officer.full_name,
          department: officer.department,
          designation: officer.designation,
          status: officer.status
        },
        credentials: credsRes.rows.map((c: any) => ({
          id: c.id,
          credentialId: c.credential_id,
          officerDid: c.officer_did,
          issuerDid: c.issuer_did,
          credentialType: c.credential_type,
          status: c.status,
          issuedAt: c.issued_at,
          validFrom: c.valid_from,
          validUntil: c.valid_until,
          suspendedAt: c.suspended_at,
          revokedAt: c.revoked_at,
          credential: typeof c.credential_payload === 'string' ? JSON.parse(c.credential_payload) : c.credential_payload
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching my credentials:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch officer credentials' }
    });
  }
}

/**
 * Public: Get a Verifiable Credential by credential_id
 * GET /api/credentials/:credentialId
 */
export async function getCredentialById(req: Request, res: Response) {
  try {
    const { credentialId } = req.params;

    const query = `
      SELECT vc.*, o.full_name, o.officer_code, o.status as officer_status, o.department, o.designation
      FROM verifiable_credentials vc
      JOIN officers o ON vc.officer_id = o.id
      WHERE vc.credential_id = $1 OR o.officer_code = $1 OR vc.officer_did = $1
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;
    const credRes = await pool.query(query, [credentialId]);

    if (credRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${credentialId}' not found` }
      });
    }

    const c = credRes.rows[0];
    const payload = typeof c.credential_payload === 'string' ? JSON.parse(c.credential_payload) : c.credential_payload;

    // Log audit view
    await logAudit({
      actorId: (req as AuthenticatedRequest).user?.id || null,
      action: 'CREDENTIAL_VIEWED',
      entityType: 'VERIFIABLE_CREDENTIAL',
      entityId: c.id,
      metadata: { credential_id: credentialId }
    });

    return res.status(200).json({
      success: true,
      data: {
        credentialId: c.credential_id,
        status: c.status,
        officerStatus: c.officer_status,
        issuedAt: c.issued_at,
        validFrom: c.valid_from,
        validUntil: c.valid_until,
        suspendedAt: c.suspended_at,
        revokedAt: c.revoked_at,
        credential: payload
      }
    });
  } catch (error) {
    console.error('Error fetching credential by ID:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch credential' }
    });
  }
}

/**
 * Public: Cryptographically verify a Verifiable Credential by credentialId
 * GET /api/credentials/:credentialId/verify
 */
export async function verifyCredentialHandler(req: Request, res: Response) {
  try {
    const { credentialId } = req.params;

    const query = `
      SELECT vc.*, o.full_name, o.officer_code, o.status as officer_status, o.department, o.designation
      FROM verifiable_credentials vc
      JOIN officers o ON vc.officer_id = o.id
      WHERE vc.credential_id = $1 OR o.officer_code = $1 OR vc.officer_did = $1
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;
    const credRes = await pool.query(query, [credentialId]);

    if (credRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${credentialId}' not found` }
      });
    }

    const record = credRes.rows[0];
    const credential = typeof record.credential_payload === 'string'
      ? JSON.parse(record.credential_payload)
      : record.credential_payload;

    // Comprehensive validity evaluation
    const evaluation = evaluateCredentialValidity(record, record.officer_status);

    // Audit log verification
    await logAudit({
      actorId: (req as AuthenticatedRequest).user?.id || null,
      action: 'CREDENTIAL_VERIFIED',
      entityType: 'VERIFIABLE_CREDENTIAL',
      entityId: record.id,
      metadata: {
        credential_id: credentialId,
        valid: evaluation.valid,
        reason: evaluation.reason,
        checks: evaluation.checks
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        ...evaluation,
        credentialId: record.credential_id,
        officer: {
          id: record.officer_id,
          fullName: record.full_name,
          officerCode: record.officer_code,
          department: record.department,
          designation: record.designation,
          status: record.officer_status
        },
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying credential:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to verify credential' }
    });
  }
}

/**
 * Public: Cryptographically verify any raw credential payload submitted directly
 * POST /api/credentials/verify
 */
export async function verifyRawCredentialHandler(req: Request, res: Response) {
  try {
    const { credential } = req.body;
    if (!credential || !credential.id || !credential.proof) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Valid credential payload with proof is required' }
      });
    }

    // Check signature
    const signatureValid = verifyCredentialSignature(credential);

    // If credential exists in DB, fetch live statuses
    let dbStatus = 'UNKNOWN';
    let officerStatus = 'UNKNOWN';

    const credRes = await pool.query(
      `SELECT vc.*, o.status as officer_status 
       FROM verifiable_credentials vc 
       JOIN officers o ON vc.officer_id = o.id 
       WHERE vc.credential_id = $1`,
      [credential.id]
    );

    if (credRes.rows.length > 0) {
      dbStatus = credRes.rows[0].status;
      officerStatus = credRes.rows[0].officer_status;
    }

    const evaluation = evaluateCredentialValidity(
      { ...credential, status: dbStatus === 'UNKNOWN' ? 'ACTIVE' : dbStatus },
      officerStatus === 'UNKNOWN' ? 'ACTIVE' : officerStatus
    );

    return res.status(200).json({
      success: true,
      data: {
        ...evaluation,
        signatureValid,
        verifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error verifying raw credential:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to verify credential' }
    });
  }
}

/**
 * Admin: Update Credential Status (ACTIVE / SUSPENDED / REVOKED)
 * PATCH /api/admin/credentials/:id/status
 */
export async function updateCredentialStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const allowedStatuses = ['ACTIVE', 'SUSPENDED', 'REVOKED'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${allowedStatuses.join(', ')}`
        }
      });
    }

    // Lookup credential by id OR credential_id
    let credRes = await pool.query('SELECT * FROM verifiable_credentials WHERE id = $1', [id]);
    if (credRes.rows.length === 0) {
      credRes = await pool.query('SELECT * FROM verifiable_credentials WHERE credential_id = $1', [id]);
    }

    if (credRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${id}' not found` }
      });
    }

    const cred = credRes.rows[0];

    // Revocation is final and irreversible
    if (cred.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CREDENTIAL_ALREADY_REVOKED',
          message: 'Cannot modify a revoked credential. Revocation is permanent.'
        }
      });
    }

    // Check officer status: cannot activate a credential if officer is SUSPENDED or REVOKED
    if (status === 'ACTIVE') {
      const officerRes = await pool.query('SELECT status FROM officers WHERE id = $1', [cred.officer_id]);
      if (officerRes.rows.length > 0 && officerRes.rows[0].status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OFFICER_NOT_ACTIVE',
            message: `Cannot activate credential while officer is ${officerRes.rows[0].status}`
          }
        });
      }
    }

    const now = new Date();
    let suspendedAt = cred.suspended_at;
    let revokedAt = cred.revoked_at;

    if (status === 'SUSPENDED') {
      suspendedAt = now;
    } else if (status === 'REVOKED') {
      revokedAt = now;
    } else if (status === 'ACTIVE') {
      suspendedAt = null;
    }

    const updateQuery = `
      UPDATE verifiable_credentials
      SET status = $1, suspended_at = $2, revoked_at = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const updateRes = await pool.query(updateQuery, [status, suspendedAt, revokedAt, cred.id]);
    const updated = updateRes.rows[0];

    // Phase 5: On-chain status synchronization if anchored
    let blockchainSync = null;
    try {
      const bcRes = await pool.query('SELECT * FROM blockchain_registry WHERE credential_id = $1', [cred.credential_id]);
      if (bcRes.rows.length > 0) {
        const bcRecord = bcRes.rows[0];
        const { blockchainService } = await import('../services/blockchain.js');
        const updateReceipt = await blockchainService.updateCredentialStatus(
          bcRecord.credential_hash,
          status as 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
        );
        await pool.query(
          'UPDATE blockchain_registry SET status = $1, tx_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE credential_id = $3',
          [status, updateReceipt.transactionHash, cred.credential_id]
        );
        blockchainSync = {
          synced: true,
          txHash: updateReceipt.transactionHash,
          blockNumber: updateReceipt.blockNumber,
          status
        };
        await logAudit({
          actorId: req.user?.id || null,
          action: 'BLOCKCHAIN_STATUS_UPDATED',
          entityType: 'BLOCKCHAIN_REGISTRY',
          entityId: bcRecord.id,
          metadata: {
            credential_id: cred.credential_id,
            credential_hash: bcRecord.credential_hash,
            new_status: status,
            tx_hash: updateReceipt.transactionHash,
            block_number: updateReceipt.blockNumber
          }
        });
      }
    } catch (bcError: any) {
      console.warn('Phase 5 on-chain status synchronization warning:', bcError?.message || bcError);
      blockchainSync = {
        synced: false,
        warning: bcError?.message || 'On-chain synchronization warning'
      };
    }

    // Audit log
    const auditAction = status === 'SUSPENDED'
      ? 'CREDENTIAL_SUSPENDED'
      : status === 'REVOKED'
      ? 'CREDENTIAL_REVOKED'
      : 'CREDENTIAL_ACTIVATED';

    await logAudit({
      actorId: req.user?.id || null,
      action: auditAction,
      entityType: 'VERIFIABLE_CREDENTIAL',
      entityId: cred.id,
      metadata: {
        credential_id: cred.credential_id,
        officer_id: cred.officer_id,
        previous_status: cred.status,
        new_status: status,
        reason: reason || null,
        blockchain_synced: !!blockchainSync?.synced
      }
    });

    return res.status(200).json({
      success: true,
      message: `Credential status updated to ${status}`,
      data: {
        id: updated.id,
        credentialId: updated.credential_id,
        status: updated.status,
        suspendedAt: updated.suspended_at,
        revokedAt: updated.revoked_at,
        updatedAt: updated.updated_at,
        blockchain: blockchainSync
      }
    });
  } catch (error) {
    console.error('Error updating credential status:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update credential status' }
    });
  }
}
