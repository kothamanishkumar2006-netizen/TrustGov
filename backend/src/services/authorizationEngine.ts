/**
 * TRUSTGOV - PHASE 8: AUTHORIZATION & RISK ENGINE
 * 
 * Answers Question 2:
 * "Even if the officer is genuine, is this particular requested action authorized and safe according to configured TrustGov policy?"
 * 
 * Strict separation of Identity (Phases 1-7) and Authorization (Phase 8).
 * Deterministic rules, explainable reason codes, zero trust of client assertions.
 */

import crypto from 'crypto';
import { pool } from '../config/db';
import {
  EvaluationInput,
  AuthorizationEvaluationResult,
  AuthorizationDecision,
  RiskLevel,
  EvaluationResultReason,
  ActionCode
} from '../types/authorization';
import { getActionDefinition, isValidActionCode } from './authorizationActions';
import { getReasonDefinition } from './authorizationReasons';
import { authorizationPolicyService } from './authorizationPolicy';
import { evaluateCredentialValidity } from './credential';
import { proofOfPossessionService } from './proofOfPossession';
import { logAudit } from './audit';

/**
 * Generate a cryptographically secure, non-sequential evaluation reference
 * Format: TG-AUTH-XXXXXXXX (8 uppercase alphanumeric characters)
 */
export function generateEvaluationReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // excludes ambiguous chars 0, 1, I, O
  const bytes = crypto.randomBytes(8);
  let ref = 'TG-AUTH-';
  for (let i = 0; i < 8; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

export class AuthorizationEngine {
  /**
   * Evaluates authorization and safety of an action requested by an officer.
   * Consumes authoritative verification state from existing verification services.
   */
  async evaluate(input: EvaluationInput, citizenId?: string | null): Promise<AuthorizationEvaluationResult> {
    const evaluationId = generateEvaluationReference();
    const evaluatedAt = new Date().toISOString();

    // Reason collections
    const triggeredReasonCodes: string[] = [];
    const triggeredReasons: EvaluationResultReason[] = [];

    const addReason = (code: string) => {
      if (!triggeredReasonCodes.includes(code)) {
        triggeredReasonCodes.push(code);
        const def = getReasonDefinition(code);
        triggeredReasons.push({
          code: def.code,
          severity: def.severity,
          title: def.title,
          message: def.citizenMessage,
          technical: def.technicalMessage
        });
      }
    };

    // Tracks checks summary
    const checksSummary: AuthorizationEvaluationResult['checksSummary'] = {
      identity: { status: 'PENDING' },
      officerStatus: { status: 'PENDING' },
      credential: { status: 'PENDING' },
      safetyRules: { status: 'PENDING' }
    };

    // -------------------------------------------------------------
    // STEP 1: Validate Requested Action against Centralized Catalog
    // -------------------------------------------------------------
    if (!input.actionCode || !isValidActionCode(input.actionCode)) {
      throw {
        statusCode: 400,
        code: 'INVALID_ACTION_CODE',
        message: `Action code '${input.actionCode}' is not registered in the TrustGov Action Catalog.`
      };
    }
    const actionDef = getActionDefinition(input.actionCode)!;

    // -------------------------------------------------------------
    // STEP 2: Resolve Officer Identity & Cryptographic Credentials
    // -------------------------------------------------------------
    const targetRef = (input.officerReference || '').trim();
    if (!targetRef) {
      throw {
        statusCode: 400,
        code: 'OFFICER_REFERENCE_REQUIRED',
        message: 'Officer identifier (code, DID, or credential ID) is required for evaluation.'
      };
    }

    const credQuery = `
      SELECT vc.*, o.id as officer_id, o.full_name, o.officer_code, o.status as officer_status,
             o.department, o.designation, o.jurisdiction
      FROM verifiable_credentials vc
      JOIN officers o ON vc.officer_id = o.id
      WHERE vc.credential_id = $1 OR o.officer_code = $1 OR vc.officer_did = $1
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;
    const credRes = await pool.query(credQuery, [targetRef]);

    let identityVerified = false;
    let officerRecord: any = null;
    let credentialRecord: any = null;

    if (credRes.rows.length === 0) {
      // Check if officer exists without credential
      const offRes = await pool.query(
        'SELECT * FROM officers WHERE officer_code = $1 OR id::text = $1',
        [targetRef]
      );
      if (offRes.rows.length > 0) {
        officerRecord = offRes.rows[0];
        checksSummary.identity = { status: 'FAILED', details: 'Officer found, but no active Verifiable Credential has been issued.' };
        checksSummary.credential = { status: 'FAILED', details: 'No credential issued.' };
        addReason('CREDENTIAL_INVALID');
      } else {
        checksSummary.identity = { status: 'FAILED', details: 'No government officer record found.' };
        checksSummary.credential = { status: 'FAILED', details: 'Record not found.' };
        addReason('IDENTITY_NOT_VERIFIED');
      }
    } else {
      credentialRecord = credRes.rows[0];
      officerRecord = {
        id: credentialRecord.officer_id,
        officer_code: credentialRecord.officer_code,
        full_name: credentialRecord.full_name,
        department: credentialRecord.department,
        designation: credentialRecord.designation,
        jurisdiction: credentialRecord.jurisdiction,
        status: credentialRecord.officer_status
      };

      // -------------------------------------------------------------
      // STEP 3: Check Officer Status
      // -------------------------------------------------------------
      const officerStatus = (officerRecord.status || '').toUpperCase();
      if (officerStatus === 'ACTIVE') {
        checksSummary.officerStatus = { status: 'PASSED', details: 'Officer is in active official service.' };
      } else if (officerStatus === 'SUSPENDED') {
        checksSummary.officerStatus = { status: 'SUSPENDED', details: 'Officer is currently under administrative suspension.' };
        addReason('OFFICER_SUSPENDED');
      } else if (officerStatus === 'REVOKED') {
        checksSummary.officerStatus = { status: 'REVOKED', details: 'Officer has been permanently revoked / dismissed.' };
        addReason('OFFICER_REVOKED');
      } else {
        checksSummary.officerStatus = { status: 'FAILED', details: 'Officer is inactive.' };
        addReason('OFFICER_INACTIVE');
      }

      // -------------------------------------------------------------
      // STEP 4: Check Credential Validity (Ed25519 signature & status)
      // -------------------------------------------------------------
      const credValidity = evaluateCredentialValidity(credentialRecord);
      if (credValidity.valid) {
        checksSummary.credential = { status: 'PASSED', details: 'Verifiable Credential signature and status are valid.' };
        if (checksSummary.officerStatus.status === 'PASSED') {
          identityVerified = true;
          checksSummary.identity = { status: 'PASSED', details: 'Officer identity cryptographically verified.' };
        } else {
          checksSummary.identity = { status: 'FAILED', details: `Officer standing is ${officerStatus}.` };
        }
      } else {
        checksSummary.credential = { status: 'FAILED', details: credValidity.reason || 'Credential invalid' };
        checksSummary.identity = { status: 'FAILED', details: 'Cryptographic credential validity check failed.' };

        if (credValidity.reason === 'CREDENTIAL_REVOKED') {
          addReason('CREDENTIAL_REVOKED');
        } else if (credValidity.reason === 'CREDENTIAL_SUSPENDED') {
          addReason('CREDENTIAL_SUSPENDED');
        } else if (credValidity.reason === 'CREDENTIAL_EXPIRED') {
          addReason('CREDENTIAL_EXPIRED');
        } else {
          addReason('CREDENTIAL_INVALID');
        }
      }

      // -------------------------------------------------------------
      // STEP 5: Check Proof of Possession (if provided)
      // -------------------------------------------------------------
      if (input.challengeId && input.signature) {
        checksSummary.proofOfPossession = { status: 'PENDING' };
        const popResult = await proofOfPossessionService.verifyProof({
          challengeId: input.challengeId,
          signature: input.signature
        });
        if (popResult.valid) {
          checksSummary.proofOfPossession = { status: 'PASSED', details: 'Live cryptographic challenge-response verified.' };
        } else {
          checksSummary.proofOfPossession = { status: 'FAILED', details: popResult.reason || 'Proof-of-possession verification failed.' };
          identityVerified = false;
          addReason('PROOF_OF_POSSESSION_FAILED');
        }
      }
    }

    // -------------------------------------------------------------
    // STEP 6: Run Deterministic Safety & Risk Rules
    // -------------------------------------------------------------
    const reqCtx = input.requestContext || {};
    let safetyViolation = false;
    let criticalSafetyViolation = false;

    // Rule 1: Prohibited Credential/Secret Requests
    if (input.actionCode === 'REQUEST_OTP') {
      addReason('OTP_REQUEST');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }
    if (input.actionCode === 'REQUEST_PIN') {
      addReason('PIN_REQUEST');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }
    if (input.actionCode === 'REQUEST_PASSWORD') {
      addReason('PASSWORD_REQUEST');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }
    if (reqCtx.requestedDataCategory === 'AUTHENTICATION_SECRET') {
      addReason('AUTHENTICATION_SECRET_REQUESTED');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }

    // Rule 2: Personal Payment Requests (UPI or Bank Account)
    if (
      input.actionCode === 'REQUEST_UPI_PAYMENT' ||
      input.actionCode === 'REQUEST_BANK_TRANSFER' ||
      reqCtx.paymentType === 'PERSONAL_UPI' ||
      reqCtx.paymentType === 'PERSONAL_BANK'
    ) {
      addReason('PERSONAL_PAYMENT_REQUEST');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }

    // Rule 3: Remote Access Software or Installation Requests
    if (input.actionCode === 'REQUEST_REMOTE_ACCESS') {
      addReason('REMOTE_ACCESS_REQUEST');
      safetyViolation = true;
    }
    if (input.actionCode === 'REQUEST_SOFTWARE_INSTALLATION') {
      addReason('SOFTWARE_INSTALL_REQUEST');
      safetyViolation = true;
    }

    // Rule 4: Urgent Payment Demand Under Threat
    if (
      (input.actionCode === 'REQUEST_PAYMENT' || reqCtx.paymentType && reqCtx.paymentType !== 'NONE') &&
      (reqCtx.urgency === 'URGENT' || reqCtx.urgency === 'IMMEDIATE')
    ) {
      addReason('URGENT_PAYMENT_DEMAND');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }

    // Rule 5: Threat / Coercion Indicators
    if (reqCtx.additionalContext && /arrest|warrant|freeze|raid|jail|seize/i.test(reqCtx.additionalContext)) {
      addReason('THREAT_BASED_REQUEST');
      safetyViolation = true;
      criticalSafetyViolation = true;
    }

    // Rule 6: Official Channel Bypass
    if (reqCtx.communicationChannel === 'WHATSAPP' || reqCtx.communicationChannel === 'PERSONAL_PHONE') {
      addReason('OFFICIAL_CHANNEL_BYPASS');
    }

    checksSummary.safetyRules = {
      status: criticalSafetyViolation ? 'CRITICAL_RISK' : safetyViolation ? 'WARNING' : 'PASSED',
      details: criticalSafetyViolation
        ? 'High-risk or prohibited indicators detected in the request.'
        : safetyViolation
        ? 'Safety alerts triggered.'
        : 'No prohibited high-risk indicators detected.'
    };

    // -------------------------------------------------------------
    // STEP 7: Lookup Active Authorization Policy
    // -------------------------------------------------------------
    const officerDept = officerRecord?.department || 'ALL';
    const officerRole = officerRecord?.designation || 'ALL';

    const policy = await authorizationPolicyService.findActivePolicy(
      officerDept,
      officerRole,
      input.actionCode
    );

    let policyMatched = false;
    let policyCode: string | null = null;
    let policyVersion: number | null = null;
    let policyDecision: AuthorizationDecision = 'REVIEW';

    if (policy) {
      policyMatched = true;
      policyCode = policy.policyCode;
      policyVersion = policy.version;
      policyDecision = policy.decision;

      // -------------------------------------------------------------
      // STEP 8: Evaluate Policy Constraints
      // -------------------------------------------------------------
      const constraints = policy.constraints || {};
      let constraintsPassed = true;

      // Allowed Channels constraint
      if (constraints.allowedChannels && reqCtx.communicationChannel) {
        if (!constraints.allowedChannels.includes(reqCtx.communicationChannel)) {
          constraintsPassed = false;
          addReason('CHANNEL_NOT_PERMITTED');
        }
      }

      // Allowed Data Categories constraint
      if (constraints.allowedDataCategories && reqCtx.requestedDataCategory) {
        if (!constraints.allowedDataCategories.includes(reqCtx.requestedDataCategory)) {
          constraintsPassed = false;
          addReason('DATA_CATEGORY_NOT_PERMITTED');
        }
      }

      // Payment allowed constraint
      if (constraints.paymentAllowed === false && (input.actionCode === 'REQUEST_PAYMENT' || (reqCtx.paymentType && reqCtx.paymentType !== 'NONE'))) {
        constraintsPassed = false;
        addReason('POLICY_CONSTRAINTS_VIOLATED');
      }

      // OTP allowed constraint
      if (constraints.otpAllowed === false && input.actionCode === 'REQUEST_OTP') {
        constraintsPassed = false;
        addReason('POLICY_CONSTRAINTS_VIOLATED');
      }

      // Remote access allowed constraint
      if (constraints.remoteAccessAllowed === false && input.actionCode === 'REQUEST_REMOTE_ACCESS') {
        constraintsPassed = false;
        addReason('POLICY_CONSTRAINTS_VIOLATED');
      }

      checksSummary.policyConstraint = {
        status: constraintsPassed ? 'PASSED' : 'FAILED',
        details: constraintsPassed
          ? 'Request satisfies declarative policy constraints.'
          : 'Request violates one or more policy constraints.'
      };

      if (!constraintsPassed && policyDecision === 'ALLOW') {
        policyDecision = 'DENY';
      }
    } else {
      addReason('NO_ACTIVE_POLICY');
      checksSummary.policyConstraint = {
        status: 'UNKNOWN',
        details: 'No active policy covers this action for this department/role.'
      };
    }

    // -------------------------------------------------------------
    // STEP 9: Synthesize Final Decision & Risk Level
    // Rule: Identity failure OR Critical Safety Violation ALWAYS overrides ALLOW!
    // -------------------------------------------------------------
    let finalDecision: AuthorizationDecision = 'DENY';
    let finalRisk: RiskLevel = 'LOW';
    let authorized = false;

    // Check identity/officer standing first
    const isOfficerStandingInvalid =
      !identityVerified ||
      checksSummary.officerStatus.status !== 'PASSED' ||
      checksSummary.credential.status !== 'PASSED';

    if (isOfficerStandingInvalid) {
      finalDecision = 'DENY';
      finalRisk = 'CRITICAL';
      authorized = false;
    } else if (criticalSafetyViolation) {
      // Identity is verified, but action is prohibited/dangerous!
      finalDecision = 'DENY';
      finalRisk = 'CRITICAL';
      authorized = false;
    } else if (input.actionCode === 'REQUEST_REMOTE_ACCESS' || input.actionCode === 'REQUEST_SOFTWARE_INSTALLATION') {
      finalDecision = 'DENY';
      finalRisk = 'HIGH';
      authorized = false;
    } else if (!policyMatched) {
      finalDecision = 'REVIEW';
      finalRisk = 'MEDIUM';
      authorized = false;
    } else if (policyDecision === 'DENY') {
      finalDecision = 'DENY';
      finalRisk = 'HIGH';
      authorized = false;
      addReason('ACTION_NOT_AUTHORIZED');
    } else if (policyDecision === 'REVIEW') {
      finalDecision = 'REVIEW';
      finalRisk = 'MEDIUM';
      authorized = false;
    } else if (policyDecision === 'ALLOW') {
      if (safetyViolation) {
        finalDecision = 'REVIEW';
        finalRisk = 'MEDIUM';
        authorized = false;
      } else {
        finalDecision = 'ALLOW';
        finalRisk = 'LOW';
        authorized = true;
      }
    }

    // -------------------------------------------------------------
    // STEP 10: Persist Safe Evaluation Record (No PII / Secrets)
    // -------------------------------------------------------------
    try {
      await pool.query(
        `INSERT INTO authorization_evaluations (
          evaluation_id, citizen_id, officer_reference, officer_name, department,
          credential_reference, action_code, policy_code, policy_version,
          decision, risk_level, reason_codes, reasons, checks_summary, is_historical, evaluated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          evaluationId,
          citizenId || null,
          targetRef,
          officerRecord?.full_name || null,
          officerRecord?.department || null,
          credentialRecord?.credential_id || null,
          input.actionCode,
          policyCode,
          policyVersion,
          finalDecision,
          finalRisk,
          JSON.stringify(triggeredReasonCodes),
          JSON.stringify(triggeredReasons),
          JSON.stringify(checksSummary),
          false,
          evaluatedAt
        ]
      );
    } catch (err) {
      console.warn('Failed to record authorization evaluation:', err);
    }

    // -------------------------------------------------------------
    // STEP 11: Emit Audit Logs
    // -------------------------------------------------------------
    await logAudit({
      actorId: citizenId || null,
      action: 'AUTHORIZATION_EVALUATED',
      entityType: 'AUTHORIZATION_EVALUATION',
      entityId: evaluationId,
      metadata: {
        actionCode: input.actionCode,
        decision: finalDecision,
        riskLevel: finalRisk,
        policyCode,
        policyVersion,
        identityVerified
      }
    });

    if (finalDecision === 'DENY') {
      await logAudit({
        actorId: citizenId || null,
        action: 'AUTHORIZATION_DENIED',
        entityType: 'AUTHORIZATION_EVALUATION',
        entityId: evaluationId,
        metadata: { actionCode: input.actionCode, reasonCodes: triggeredReasonCodes }
      });
    }

    if (finalDecision === 'REVIEW') {
      await logAudit({
        actorId: citizenId || null,
        action: 'AUTHORIZATION_REVIEW_REQUIRED',
        entityType: 'AUTHORIZATION_EVALUATION',
        entityId: evaluationId,
        metadata: { actionCode: input.actionCode, reasonCodes: triggeredReasonCodes }
      });
    }

    if (finalRisk === 'CRITICAL') {
      await logAudit({
        actorId: citizenId || null,
        action: 'AUTHORIZATION_CRITICAL_RISK',
        entityType: 'AUTHORIZATION_EVALUATION',
        entityId: evaluationId,
        metadata: { actionCode: input.actionCode, reasonCodes: triggeredReasonCodes }
      });
    }

    // -------------------------------------------------------------
    // STEP 12: Return Standard Result
    // -------------------------------------------------------------
    return {
      evaluationId,
      decision: finalDecision,
      authorized,
      riskLevel: finalRisk,
      identityVerified,
      policyMatched,
      policyCode,
      policyVersion,
      actionCode: input.actionCode,
      reasonCodes: triggeredReasonCodes,
      reasons: triggeredReasons,
      checksSummary,
      officer: {
        reference: targetRef,
        fullName: officerRecord?.full_name || 'Government Officer',
        department: officerRecord?.department || 'Official Department',
        designation: officerRecord?.designation || 'Officer',
        jurisdiction: officerRecord?.jurisdiction || undefined
      },
      evaluatedAt,
      disclaimer:
        'TrustGov Demo Authorization Policies evaluate action safety against prototype security guardrails. An ALLOW result indicates compliance with demo policies and does not constitute real-world legal authorization.'
    };
  }
}

export const authorizationEngine = new AuthorizationEngine();
