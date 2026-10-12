/**
 * TRUSTGOV - PHASE 7: Citizen Verification & Trust Experience Controller
 * 
 * Provides:
 * 1. POST /api/citizen/verify: Unified citizen verification orchestration
 * 2. GET /api/citizen/verifications: Citizen verification history
 * 3. GET /api/citizen/verifications/:id: Single verification history record
 * 4. GET /api/verification/public/:reference: Safe non-PII historical verification reference lookup
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { evaluateCredentialValidity } from '../services/credential';
import { proofOfPossessionService } from '../services/proofOfPossession';
import { logAudit } from '../services/audit';

// Prohibited actions that trigger anti-scam alert
const PROHIBITED_ACTIONS = [
  'PERSONAL_UPI_PAYMENT',
  'OTP_REQUEST',
  'PASSWORD_REQUEST',
  'PIN_REQUEST',
  'REMOTE_ACCESS_SOFTWARE',
  'SECURITY_DEPOSIT'
];

/**
 * Generate a cryptographically secure, non-sequential verification reference
 * Format: TG-VFY-XXXXXXXX (8 uppercase alphanumeric characters)
 */
export function generateVerificationReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes ambiguous chars 0, 1, I, O
  const bytes = crypto.randomBytes(8);
  let ref = 'TG-VFY-';
  for (let i = 0; i < 8; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

/**
 * Unified Citizen Verification Endpoint
 * POST /api/citizen/verify
 */
export async function verifyOfficerHandler(req: Request, res: Response) {
  try {
    const { method, value, challengeId, signature, claimedAction } = req.body;
    const actorId = (req as AuthenticatedRequest).user?.id || null;

    const validMethods = ['QR', 'OFFICER_CODE', 'CREDENTIAL_ID', 'DID'];
    if (!method || !validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_METHOD', message: `Method must be one of: ${validMethods.join(', ')}` }
      });
    }

    if (!value || typeof value !== 'string' || !value.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALUE_REQUIRED', message: 'Verification target value is required' }
      });
    }

    const verificationId = generateVerificationReference();
    const trimmedValue = value.trim();

    // 1. Resolve identifier
    let targetIdentifier = trimmedValue;
    if (method === 'QR') {
      const directMatch = trimmedValue.match(/^TRUSTGOV:\/\/verify\/([a-zA-Z0-9_-]+)$/i);
      const paramMatch = trimmedValue.match(/^TRUSTGOV:\/\/verify\?.*credential=([a-zA-Z0-9_-]+)/i);

      if (directMatch) {
        targetIdentifier = directMatch[1];
      } else if (paramMatch) {
        targetIdentifier = paramMatch[1];
      } else {
        // Record failed attempt
        if (actorId) {
          try {
            await pool.query(
              `INSERT INTO citizen_verification_history (
                verification_id, citizen_id, verification_method, officer_reference, officer_name,
                department, credential_reference, result, failure_reason, checks_summary, verified_at, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, CURRENT_TIMESTAMP)`,
              [
                verificationId, actorId, method, null, null, null, null,
                'FAILED', 'UNSUPPORTED_QR_SCHEME',
                JSON.stringify({ qrScheme: 'INVALID' })
              ]
            );
          } catch {}
        }

        await logAudit({
          actorId,
          action: 'CITIZEN_VERIFICATION_FAILED',
          entityType: 'CITIZEN_VERIFICATION',
          entityId: verificationId,
          metadata: { method, reason: 'UNSUPPORTED_QR_SCHEME' }
        });

        return res.status(400).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_QR_SCHEME',
            message: 'The scanned QR code is not a valid TrustGov official verification QR code.'
          },
          data: {
            verificationId,
            result: 'FAILED',
            method,
            failureReason: 'The scanned QR code is not a valid TrustGov official verification QR code.',
            checks: {
              identity: { status: 'FAILED' },
              credential: { status: 'FAILED' },
              officerStatus: { status: 'UNKNOWN' },
              proofOfPossession: { status: 'NOT_CHECKED' },
              blockchain: { status: 'FAILED' }
            }
          }
        });
      }
    }

    // 2. Query Verifiable Credential and Officer Information
    const query = `
      SELECT vc.*, o.id as officer_id, o.full_name, o.officer_code, o.status as officer_status,
             o.department, o.designation, o.jurisdiction
      FROM verifiable_credentials vc
      JOIN officers o ON vc.officer_id = o.id
      WHERE vc.credential_id = $1 OR o.officer_code = $1 OR vc.officer_did = $1
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;

    const credRes = await pool.query(query, [targetIdentifier]);

    // Handle Not Found cases
    if (credRes.rows.length === 0) {
      // Check if officer exists without credential
      const offRes = await pool.query('SELECT * FROM officers WHERE officer_code = $1 OR id::text = $1', [targetIdentifier]);
      let failureReason = 'No official government record found matching this identifier.';
      let failureCode = 'OFFICER_NOT_FOUND';

      if (offRes.rows.length > 0) {
        failureReason = 'Officer found, but no active Verifiable Credential has been issued.';
        failureCode = 'NO_CREDENTIAL_ISSUED';
      }

      if (actorId) {
        try {
          await pool.query(
            `INSERT INTO citizen_verification_history (
              verification_id, citizen_id, verification_method, officer_reference, officer_name,
              department, credential_reference, result, failure_reason, checks_summary, verified_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, CURRENT_TIMESTAMP)`,
            [
              verificationId, actorId, method, targetIdentifier, null, null, null,
              'FAILED', failureCode,
              JSON.stringify({ identity: 'NOT_FOUND', credential: 'NOT_FOUND' })
            ]
          );
        } catch {}
      }

      await logAudit({
        actorId,
        action: 'CITIZEN_VERIFICATION_FAILED',
        entityType: 'CITIZEN_VERIFICATION',
        entityId: verificationId,
        metadata: { method, targetIdentifier, reason: failureCode }
      });

      return res.status(404).json({
        success: false,
        error: { code: failureCode, message: failureReason },
        data: {
          verificationId,
          result: 'FAILED',
          method,
          failureReason,
          checks: {
            identity: { status: 'FAILED' },
            credential: { status: 'FAILED' },
            officerStatus: { status: 'UNKNOWN' },
            proofOfPossession: { status: 'NOT_CHECKED' },
            blockchain: { status: 'FAILED' }
          }
        }
      });
    }

    const record = credRes.rows[0];

    // 3. Evaluate Credential Validity & Digital Signature
    const credEval = evaluateCredentialValidity(record, record.officer_status);

    // 4. Evaluate DID Identity Status
    let didValid = false;
    let didStatus = 'UNKNOWN';
    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [record.officer_id]);
    if (didRes.rows.length > 0) {
      didStatus = didRes.rows[0].status;
      didValid = didStatus === 'ACTIVE';
    }

    // 5. Evaluate Blockchain Integrity Anchor
    let blockchainValid = false;
    let blockchainData: any = null;
    try {
      const bcRes = await pool.query('SELECT * FROM blockchain_registry WHERE credential_id = $1', [record.credential_id]);
      if (bcRes.rows.length > 0) {
        const bc = bcRes.rows[0];
        blockchainValid = bc.status === 'ACTIVE';
        blockchainData = {
          anchored: true,
          status: bc.status,
          contractAddress: bc.contract_address,
          transactionHash: bc.tx_hash,
          blockNumber: bc.block_number,
          network: 'hardhat'
        };
      }
    } catch {
      // Non-blocking
    }

    // 6. Evaluate Proof of Possession (if provided)
    let popStatus: 'VERIFIED' | 'FAILED' | 'NOT_PROVIDED' = 'NOT_PROVIDED';
    let popDetails: any = null;

    if (challengeId && signature) {
      try {
        const popResult = await proofOfPossessionService.verifyProof({
          challengeId,
          signature: signature.trim(),
          actorId
        });
        if (popResult.valid) {
          popStatus = 'VERIFIED';
          popDetails = popResult;
        } else {
          popStatus = 'FAILED';
          popDetails = popResult;
        }
      } catch (err: any) {
        popStatus = 'FAILED';
        popDetails = { reason: err.message || 'Signature verification error' };
      }
    }

    // 7. Synthesize Verification Result
    const isOfficerActive = record.officer_status === 'ACTIVE';
    const isCredentialValid = credEval.valid;
    const isProofValid = popStatus !== 'FAILED';

    const overallVerified = didValid && isOfficerActive && isCredentialValid && isProofValid;
    const finalResult: 'VERIFIED' | 'FAILED' = overallVerified ? 'VERIFIED' : 'FAILED';

    let failureReason: string | null = null;
    if (!overallVerified) {
      if (!isOfficerActive) {
        failureReason = `Officer status is currently ${record.officer_status}.`;
      } else if (!isCredentialValid) {
        failureReason = credEval.reason || 'Verifiable credential signature or date check failed.';
      } else if (!didValid) {
        failureReason = `Officer DID identity is currently ${didStatus}.`;
      } else if (popStatus === 'FAILED') {
        failureReason = popDetails?.reason || 'Officer proof of possession signature did not match.';
      }
    }

    // 8. Anti-Scam Guardrail Analysis
    const isProhibited = claimedAction ? PROHIBITED_ACTIONS.includes(claimedAction) : false;
    const safetyGuidance = {
      isProhibitedDemand: isProhibited,
      warning: isProhibited
        ? 'CRITICAL SCAM WARNING: Government officers and police are NEVER authorized to demand money transfers to personal bank accounts/UPI or request OTPs, passwords, or PINs. Terminate the interaction immediately.'
        : 'Identity verification confirms who the officer is, but does NOT authorize them to demand confidential financial information or money transfers.',
      rules: [
        'Never transfer money to personal UPI or bank accounts.',
        'Never disclose OTPs, banking PINs, or account passwords.',
        'Never install remote screen-sharing software at an officer’s demand.'
      ]
    };

    const checksSummary = {
      identity: didValid ? 'VERIFIED' : 'FAILED',
      credential: isCredentialValid ? 'VERIFIED' : 'FAILED',
      officerStatus: record.officer_status,
      proofOfPossession: popStatus,
      blockchain: blockchainValid ? 'VERIFIED' : 'UNANCHORED'
    };

    // 9. Persist History for Authenticated Citizen
    const verifiedAt = overallVerified ? new Date() : null;
    if (actorId) {
      try {
        await pool.query(
          `INSERT INTO citizen_verification_history (
            verification_id, citizen_id, verification_method, officer_reference, officer_name,
            department, credential_reference, result, failure_reason, checks_summary, verified_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
          [
            verificationId,
            actorId,
            method,
            record.officer_code,
            record.full_name,
            record.department,
            record.credential_id,
            finalResult,
            failureReason,
            JSON.stringify(checksSummary),
            verifiedAt
          ]
        );
      } catch (histErr) {
        console.warn('Failed to insert citizen verification history:', histErr);
      }
    }

    // 10. Audit Logging
    await logAudit({
      actorId,
      action: overallVerified ? 'CITIZEN_VERIFICATION_SUCCEEDED' : 'CITIZEN_VERIFICATION_FAILED',
      entityType: 'CITIZEN_VERIFICATION',
      entityId: verificationId,
      metadata: {
        method,
        officer_code: record.officer_code,
        credential_id: record.credential_id,
        result: finalResult,
        proof_status: popStatus
      }
    });

    const responsePayload = {
      verificationId,
      result: finalResult,
      method,
      timestamp: new Date().toISOString(),
      officer: {
        fullName: record.full_name,
        officerCode: record.officer_code,
        department: record.department,
        designation: record.designation,
        jurisdiction: record.jurisdiction,
        status: record.officer_status
      },
      checks: {
        identity: {
          status: didValid ? 'VERIFIED' : 'FAILED',
          did: record.officer_did,
          didStatus
        },
        credential: {
          status: isCredentialValid ? 'VERIFIED' : 'FAILED',
          credentialId: record.credential_id,
          credentialStatus: record.status,
          signatureValid: credEval.signatureValid,
          validUntil: record.valid_until
        },
        officerStatus: {
          status: record.officer_status,
          active: isOfficerActive
        },
        proofOfPossession: {
          status: popStatus,
          details: popDetails
        },
        blockchain: {
          status: blockchainValid ? 'VERIFIED' : 'UNANCHORED',
          anchored: blockchainValid,
          details: blockchainData
        }
      },
      failureReason,
      safety: safetyGuidance
    };

    return res.status(200).json({
      success: true,
      message: overallVerified ? 'Officer successfully verified' : 'Officer verification failed',
      data: responsePayload
    });
  } catch (error: any) {
    console.error('Error in citizen verification handler:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Internal verification error' },
      data: {
        result: 'INCOMPLETE',
        failureReason: 'Verification service temporarily unavailable.'
      }
    });
  }
}

/**
 * Authenticated Citizen: Get own verification history
 * GET /api/citizen/verifications
 */
export async function getVerificationHistoryHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const citizenId = req.user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const query = `
      SELECT id, verification_id, verification_method, officer_reference, officer_name,
             department, credential_reference, result, failure_reason, checks_summary,
             verified_at, created_at
      FROM citizen_verification_history
      WHERE citizen_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [citizenId]);

    // Audit log
    await logAudit({
      actorId: citizenId,
      action: 'VERIFICATION_HISTORY_VIEWED',
      entityType: 'CITIZEN_HISTORY',
      entityId: citizenId,
      metadata: { count: result.rows.length }
    });

    return res.status(200).json({
      success: true,
      data: {
        history: result.rows.map((row: any) => ({
          id: row.id,
          verificationId: row.verification_id,
          method: row.verification_method,
          officerCode: row.officer_reference,
          officerName: row.officer_name,
          department: row.department,
          credentialId: row.credential_reference,
          result: row.result,
          failureReason: row.failure_reason,
          checksSummary: typeof row.checks_summary === 'string' ? JSON.parse(row.checks_summary) : row.checks_summary,
          verifiedAt: row.verified_at,
          createdAt: row.created_at
        }))
      }
    });
  } catch (error: any) {
    console.error('Error fetching verification history:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve verification history' }
    });
  }
}

/**
 * Authenticated Citizen: Get single verification history record
 * GET /api/citizen/verifications/:id
 */
export async function getVerificationDetailsHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const citizenId = req.user?.id;
    const { id } = req.params;

    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
    }

    const query = `
      SELECT id, verification_id, verification_method, officer_reference, officer_name,
             department, credential_reference, result, failure_reason, checks_summary,
             verified_at, created_at
      FROM citizen_verification_history
      WHERE (id = $1 OR verification_id = $1) AND citizen_id = $2
    `;

    const result = await pool.query(query, [id, citizenId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECORD_NOT_FOUND', message: 'Verification record not found' }
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: row.id,
        verificationId: row.verification_id,
        method: row.verification_method,
        officerCode: row.officer_reference,
        officerName: row.officer_name,
        department: row.department,
        credentialId: row.credential_reference,
        result: row.result,
        failureReason: row.failure_reason,
        checksSummary: typeof row.checks_summary === 'string' ? JSON.parse(row.checks_summary) : row.checks_summary,
        verifiedAt: row.verified_at,
        createdAt: row.created_at
      }
    });
  } catch (error: any) {
    console.error('Error fetching verification record:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve verification record' }
    });
  }
}

/**
 * Public: Retrieve safe, non-sensitive historical verification reference summary
 * GET /api/verification/public/:reference
 */
export async function getPublicVerificationReferenceHandler(req: Request, res: Response) {
  try {
    const { reference } = req.params;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REFERENCE', message: 'Verification reference string is required' }
      });
    }

    const query = `
      SELECT verification_id, verification_method, officer_reference, department,
             result, checks_summary, verified_at, created_at
      FROM citizen_verification_history
      WHERE verification_id = $1
    `;

    const result = await pool.query(query, [reference.trim()]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'REFERENCE_NOT_FOUND', message: `Verification reference '${reference}' not found` }
      });
    }

    const row = result.rows[0];

    // Log view
    await logAudit({
      actorId: null,
      action: 'VERIFICATION_RESULT_SHARED',
      entityType: 'PUBLIC_REFERENCE',
      entityId: row.verification_id,
      metadata: { verification_id: row.verification_id }
    });

    // PRIVACY ENFORCEMENT: Never expose citizen ID, user details, JWTs, or private keys
    return res.status(200).json({
      success: true,
      data: {
        verificationId: row.verification_id,
        result: row.result,
        method: row.verification_method,
        officer: {
          officerCode: row.officer_reference,
          department: row.department
        },
        checksSummary: typeof row.checks_summary === 'string' ? JSON.parse(row.checks_summary) : row.checks_summary,
        verifiedAt: row.verified_at || row.created_at,
        isHistorical: true,
        disclaimer: 'This is a historical verification record. Officer credentials, suspension, or active status may have changed since this timestamp.'
      }
    });
  } catch (error: any) {
    console.error('Error fetching public verification reference:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve verification reference' }
    });
  }
}
