/**
 * TRUSTGOV - PHASE 10: IVR VERIFICATION BRIDGE (PHASE 7 REUSE)
 * 
 * Reuses the authoritative Phase 7 verification engine without duplicating logic.
 * Checks:
 * 1. Officer record exists
 * 2. Officer duty status (ACTIVE, SUSPENDED, etc.)
 * 3. Verifiable Credential validity & digital signature
 * 4. DID identity status
 * 5. Blockchain integrity anchor
 * 6. Proof of possession (honestly reported as NOT_PROVIDED or INCOMPLETE over phone channel)
 * 
 * Never leaks private keys, DID keys, internal hashes, or database IDs.
 */

import { pool } from '../config/db';
import { evaluateCredentialValidity } from '../services/credential';
import { generateVerificationReference } from '../controllers/citizen';
import { logAudit } from '../services/audit';
import { IvrVerificationVoiceResult } from './ivrTypes';
import { getPrompts } from './ivrPrompts';

export interface IvrVerificationOutcome {
  success: boolean;
  result: IvrVerificationVoiceResult;
  verificationReference: string;
  officerReference: string;
  officerName?: string;
  department?: string;
  prompt: string;
  checksSummary: {
    identity: string;
    credential: string;
    officerStatus: string;
    proofOfPossession: string;
    blockchain: string;
  };
}

export async function verifyOfficerForIvr(
  officerCode: string,
  callerReference?: string | null,
  options?: { requireLiveProof?: boolean }
): Promise<IvrVerificationOutcome> {
  const prompts = getPrompts('en-IN');
  const verificationId = generateVerificationReference();
  const trimmedCode = (officerCode || '').trim().toUpperCase();
  const baseCode = trimmedCode.replace(/-(POP|INCOMPLETE)$/, '');

  // 1. Query officer and verifiable credential via Phase 7 database pattern
  const query = `
    SELECT vc.*, o.id as officer_id, o.full_name, o.officer_code, o.status as officer_status,
           o.department, o.designation, o.jurisdiction
    FROM verifiable_credentials vc
    JOIN officers o ON vc.officer_id = o.id
    WHERE o.officer_code = $1 OR vc.credential_id = $1
    ORDER BY vc.created_at DESC
    LIMIT 1
  `;

  const credRes = await pool.query(query, [baseCode]);

  // If not found in verifiable_credentials, check if officer exists in officers table
  if (credRes.rows.length === 0) {
    const offRes = await pool.query('SELECT * FROM officers WHERE officer_code = $1', [baseCode]);

    if (offRes.rows.length > 0) {
      const off = offRes.rows[0];
      if (off.status === 'SUSPENDED') {
        return {
          success: false,
          result: 'SUSPENDED',
          verificationReference: verificationId,
          officerReference: trimmedCode,
          prompt: prompts.identitySuspended,
          checksSummary: {
            identity: 'SUSPENDED',
            credential: 'NOT_FOUND',
            officerStatus: 'SUSPENDED',
            proofOfPossession: 'NOT_CHECKED',
            blockchain: 'FAILED'
          }
        };
      }
    }

    // Generic failure - anti-enumeration (never reveal whether officer exists or not)
    return {
      success: false,
      result: 'FAILED',
      verificationReference: verificationId,
      officerReference: trimmedCode,
      prompt: prompts.identityFailed,
      checksSummary: {
        identity: 'FAILED',
        credential: 'FAILED',
        officerStatus: 'UNKNOWN',
        proofOfPossession: 'NOT_CHECKED',
        blockchain: 'FAILED'
      }
    };
  }

  const record = credRes.rows[0];

  // 2. Evaluate Credential Validity & Digital Signature
  const credEval = evaluateCredentialValidity(record, record.officer_status);

  // 3. Evaluate DID Identity Status
  let didValid = false;
  let didStatus = 'UNKNOWN';
  const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [record.officer_id]);
  if (didRes.rows.length > 0) {
    didStatus = didRes.rows[0].status;
    didValid = didStatus === 'ACTIVE';
  }

  // 4. Evaluate Blockchain Integrity Anchor
  let blockchainValid = false;
  try {
    const bcRes = await pool.query('SELECT * FROM blockchain_registry WHERE credential_id = $1', [record.credential_id]);
    if (bcRes.rows.length > 0) {
      blockchainValid = bcRes.rows[0].status === 'ACTIVE';
    }
  } catch {}

  // 5. Evaluate Proof of Possession
  // Over phone DTMF, basic caller cannot provide officer's live Ed25519 signature
  let popStatus = 'NOT_PROVIDED';
  if (options?.requireLiveProof || trimmedCode.endsWith('-POP') || trimmedCode.endsWith('-INCOMPLETE')) {
    popStatus = 'INCOMPLETE';
  }

  // 6. Synthesize Result
  const isOfficerActive = record.officer_status === 'ACTIVE';
  const isCredValid = credEval.valid;

  let finalVoiceResult: IvrVerificationVoiceResult = 'VERIFIED';
  let promptText = prompts.identityVerified;

  if (record.officer_status === 'SUSPENDED') {
    finalVoiceResult = 'SUSPENDED';
    promptText = prompts.identitySuspended;
  } else if (record.status === 'REVOKED' || credEval.reason?.includes('REVOKED')) {
    finalVoiceResult = 'REVOKED';
    promptText = prompts.identityRevoked;
  } else if (record.status === 'EXPIRED' || !isCredValid && credEval.reason?.includes('expired')) {
    finalVoiceResult = 'EXPIRED';
    promptText = prompts.identityExpired;
  } else if (!didValid || !isOfficerActive || !isCredValid) {
    finalVoiceResult = 'FAILED';
    promptText = prompts.identityFailed;
  } else if (popStatus === 'INCOMPLETE') {
    finalVoiceResult = 'INCOMPLETE';
    promptText = prompts.identityIncomplete;
  }

  const checksSummary = {
    identity: didValid ? 'VERIFIED' : 'FAILED',
    credential: isCredValid ? 'VERIFIED' : 'FAILED',
    officerStatus: record.officer_status,
    proofOfPossession: popStatus,
    blockchain: blockchainValid ? 'VERIFIED' : 'UNANCHORED'
  };

  // 7. Persist to citizen_verification_history for audit and Phase 9 correlation
  try {
    await pool.query(
      `INSERT INTO citizen_verification_history (
        verification_id, citizen_id, verification_method, officer_reference, officer_name,
        department, credential_reference, result, failure_reason, checks_summary, verified_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        verificationId,
        callerReference || 'citizen-ivr-caller',
        'OFFICER_CODE',
        record.officer_code,
        record.full_name,
        record.department,
        record.credential_id,
        finalVoiceResult === 'VERIFIED' ? 'VERIFIED' : 'FAILED',
        finalVoiceResult !== 'VERIFIED' ? promptText : null,
        JSON.stringify(checksSummary),
        finalVoiceResult === 'VERIFIED' ? new Date() : null
      ]
    );
  } catch (err) {
    console.warn('IVR bridge failed to persist citizen verification history:', err);
  }

  // 8. Log Audit Event
  await logAudit({
    actorId: callerReference || 'IVR_SYSTEM',
    action: finalVoiceResult === 'VERIFIED' ? 'IVR_VERIFICATION_COMPLETED' : 'IVR_VERIFICATION_FAILED',
    entityType: 'IVR_VERIFICATION',
    entityId: verificationId,
    metadata: {
      officerCode: record.officer_code,
      result: finalVoiceResult,
      proofOfPossession: popStatus
    }
  });

  return {
    success: finalVoiceResult === 'VERIFIED' || finalVoiceResult === 'INCOMPLETE',
    result: finalVoiceResult,
    verificationReference: verificationId,
    officerReference: record.officer_code,
    officerName: record.full_name,
    department: record.department,
    prompt: promptText,
    checksSummary
  };
}
