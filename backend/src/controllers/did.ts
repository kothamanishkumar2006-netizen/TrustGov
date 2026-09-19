/**
 * TRUSTGOV - PHASE 3: DID Controllers
 * 
 * Implements:
 * 1. POST /api/admin/officers/:id/did (Issue Officer DID)
 * 2. GET /api/admin/officers/:id/did (Get Officer DID Details & DID Document)
 * 3. GET /api/did/:did (Public DID Resolution)
 * 
 * CRITICAL SECURITY:
 * Private keys are NEVER stored in the database, NEVER returned in API responses,
 * NEVER printed in logs, and NEVER exposed in DID Documents.
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import {
  generateEd25519KeyPair,
  generateDID,
  isValidDID,
  buildDIDDocument
} from '../services/crypto';

/**
 * Admin: Issue a new cryptographically verifiable DID for an officer
 * POST /api/admin/officers/:id/did
 */
export async function issueOfficerDID(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // 1. Check if officer exists
    const officerRes = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (officerRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID '${id}' not found` }
      });
    }

    const officer = officerRes.rows[0];

    // 2. Validate officer status
    if (officer.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        error: { code: 'OFFICER_REVOKED', message: 'Cannot issue a DID to a revoked officer' }
      });
    }

    // 3. Check whether DID already exists for this officer (1:1 enforcement)
    const existingDidRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [id]);
    if (existingDidRes.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DID_ALREADY_EXISTS',
          message: 'Officer already has a DID identity.'
        }
      });
    }

    // 4. Generate Ed25519 cryptographic key pair
    const keyPair = generateEd25519KeyPair();
    const did = generateDID();
    const initialStatus = officer.status; // Matches officer status (e.g. ACTIVE or SUSPENDED)

    // 5. Store DID in did_identities table (CRITICAL: private key is NEVER saved)
    const insertQuery = `
      INSERT INTO did_identities (officer_id, did, public_key, key_type, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, officer_id, did, public_key, key_type, status, created_at, updated_at
    `;
    const insertRes = await pool.query(insertQuery, [
      officer.id,
      did,
      keyPair.publicKeyMultibase,
      'Ed25519',
      initialStatus
    ]);
    const storedIdentity = insertRes.rows[0];

    // 6. Keep officer table backward-compatible
    try {
      await pool.query(
        'UPDATE officers SET did = $1, public_key = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [did, keyPair.publicKeyMultibase, officer.id]
      );
    } catch (updateErr) {
      console.warn('Could not update legacy fields on officers table:', updateErr);
    }

    // 7. Record Audit Log (DID_ISSUED)
    await logAudit({
      actorId: req.user?.id || null,
      action: 'DID_ISSUED',
      entityType: 'DID_IDENTITY',
      entityId: storedIdentity.id,
      metadata: {
        officer_id: officer.id,
        officer_code: officer.officer_code,
        did: storedIdentity.did,
        key_type: storedIdentity.key_type,
        status: storedIdentity.status
      }
    });

    // 8. Return safe API response (ZERO private key material)
    return res.status(201).json({
      success: true,
      message: 'DID issued successfully',
      data: {
        did: storedIdentity.did,
        keyType: storedIdentity.key_type,
        status: storedIdentity.status,
        publicKey: storedIdentity.public_key
      }
    });
  } catch (error) {
    console.error('Error issuing officer DID:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to issue officer DID' }
    });
  }
}

/**
 * Admin: Get DID Identity and formatted DID Document for an officer
 * GET /api/admin/officers/:id/did
 */
export async function getOfficerDID(req: AuthenticatedRequest, res: Response) {
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

    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [id]);
    if (didRes.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          issued: false,
          message: 'DID has not been issued yet for this officer.'
        }
      });
    }

    const identity = didRes.rows[0];
    const didDoc = buildDIDDocument(
      identity.did,
      identity.public_key,
      identity.status,
      identity.created_at,
      identity.updated_at
    );

    return res.status(200).json({
      success: true,
      data: {
        issued: true,
        did: identity.did,
        keyType: identity.key_type,
        status: identity.status,
        publicKey: identity.public_key,
        createdAt: identity.created_at,
        updatedAt: identity.updated_at,
        didDocument: didDoc
      }
    });
  } catch (error) {
    console.error('Error fetching officer DID:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch officer DID' }
    });
  }
}

/**
 * Public: Resolve a DID into its public DID Document
 * GET /api/did/:did
 */
export async function resolveDID(req: Request, res: Response) {
  try {
    const { did } = req.params;

    // 1. Validate DID format
    if (!isValidDID(did)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DID_FORMAT',
          message: 'Malformed DID format. Expected: did:trustgov:<UUID>'
        }
      });
    }

    // 2. Query DID registry
    const didRes = await pool.query('SELECT * FROM did_identities WHERE did = $1', [did]);
    if (didRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DID_NOT_FOUND',
          message: `DID '${did}' was not found in the TrustGov identity registry`
        }
      });
    }

    const identity = didRes.rows[0];

    // 3. Build W3C DID Document
    const didDocument = buildDIDDocument(
      identity.did,
      identity.public_key,
      identity.status,
      identity.created_at,
      identity.updated_at
    );

    // 4. Return formatted response (Contains ONLY public identity information)
    return res.status(200).json({
      success: true,
      data: didDocument,
      ...didDocument
    });
  } catch (error) {
    console.error('Error resolving DID:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to resolve DID' }
    });
  }
}
