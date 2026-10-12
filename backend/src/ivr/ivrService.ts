/**
 * TRUSTGOV - PHASE 10: IVR CORE SERVICE & STATE MACHINE
 * 
 * Central orchestrator connecting DTMF keypad input to:
 * - Phase 7 Officer Verification
 * - Phase 8 Action Authorization & Risk Engine
 * - Phase 9 Scam Incident Reporting
 * - Server-side Session Lifecycle Management
 * 
 * Enforces strict security:
 * - Server-side state is strictly authoritative
 * - Anti-enumeration phrasing
 * - Zero secrets or internal database structures leaked
 * - Phone numbers pseudonymized
 */

import { pool } from '../config/db';
import {
  IvrSession,
  IvrSessionResponse,
  IvrInputRequest,
  IvrStartCallRequest
} from './ivrTypes';
import { ivrSessionManager } from './ivrSession';
import {
  getPrompts,
  formatSpokenReference
} from './ivrPrompts';
import {
  normalizeOfficerCode,
  normalizeDtmfDigit,
  isInputOversized,
  MAX_OFFICER_ATTEMPTS,
  MAX_ACTION_ATTEMPTS,
  MAX_MENU_ATTEMPTS
} from './ivrSecurity';
import { verifyOfficerForIvr } from './ivrVerificationBridge';
import { authorizationEngine } from '../services/authorizationEngine';
import { isValidActionCode } from '../services/authorizationActions';
import { reportService } from '../services/reportService';
import { ReportCategoryCode } from '../types/reports';
import { isValidReportCategory } from '../services/reportCategories';
import { logAudit } from '../services/audit';

export class IvrService {
  /**
   * Start a new IVR Call Session
   */
  async startCall(req: IvrStartCallRequest = {}): Promise<IvrSessionResponse> {
    const session = await ivrSessionManager.createSession(req.callerId);
    const prompts = getPrompts(req.language || 'en-IN');

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_SESSION_STARTED',
      entityType: 'IVR_SESSION',
      entityId: session.sessionId,
      metadata: {
        callerToken: session.callerReference,
        expiresAt: session.expiresAt.toISOString()
      }
    });

    const initialPrompt = `${prompts.welcome} ${prompts.mainMenu}`;

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: initialPrompt,
      options: ['1: Verify Officer', '2: Check Action', '3: Report Interaction', '9: End Call'],
      attemptCount: session.attemptCount,
      maxAttempts: session.maxAttempts,
      expiresAt: session.expiresAt.toISOString()
    };
  }

  /**
   * Process Caller Input (DTMF or simulated Speech)
   */
  async processInput(sessionId: string, input: IvrInputRequest): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const session = await ivrSessionManager.getSession(sessionId);

    if (!session) {
      throw {
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'The requested IVR verification session was not found.'
      };
    }

    // Check terminal statuses
    if (session.status === 'EXPIRED') {
      await logAudit({
        actorId: session.callerReference || 'IVR_CALLER',
        action: 'IVR_SESSION_EXPIRED',
        entityType: 'IVR_SESSION',
        entityId: session.sessionId,
        metadata: { state: session.state }
      });
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: 'EXPIRED',
        prompt: prompts.sessionExpired
      };
    }

    if (session.status === 'LOCKED') {
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: 'LOCKED',
        prompt: prompts.sessionLocked
      };
    }

    if (session.status === 'COMPLETED') {
      return {
        sessionId: session.sessionId,
        state: 'END',
        status: 'COMPLETED',
        prompt: prompts.hangup
      };
    }

    // Input Validation
    if (!input || !input.value || typeof input.value !== 'string') {
      const allowed = await ivrSessionManager.recordAttempt(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: allowed ? `Input required. ${prompts.mainMenu}` : prompts.sessionLocked,
        attemptCount: session.attemptCount
      };
    }

    if (isInputOversized(input.value)) {
      const allowed = await ivrSessionManager.recordAttempt(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: allowed ? `Input too long. ${prompts.mainMenu}` : prompts.sessionLocked,
        attemptCount: session.attemptCount
      };
    }

    const rawValue = input.value.trim();

    // Universal repeat option: '0'
    if (rawValue === '0') {
      return this.repeatPrompt(session);
    }

    // Universal hangup option: '9'
    if (rawValue === '9') {
      await ivrSessionManager.completeSession(session);
      await logAudit({
        actorId: session.callerReference || 'IVR_CALLER',
        action: 'IVR_SESSION_COMPLETED',
        entityType: 'IVR_SESSION',
        entityId: session.sessionId,
        metadata: { finalState: session.state }
      });
      return {
        sessionId: session.sessionId,
        state: 'END',
        status: 'COMPLETED',
        prompt: prompts.hangup
      };
    }

    // STATE MACHINE DISPATCH
    switch (session.state) {
      case 'WELCOME':
      case 'MENU':
        return this.handleMenuState(session, rawValue);

      case 'COLLECT_OFFICER_CODE':
        return this.handleCollectOfficerCodeState(session, rawValue);

      case 'IDENTITY_RESULT':
        return this.handleIdentityResultMenu(session, rawValue);

      case 'ACTION_MENU':
      case 'COLLECT_ACTION':
        return this.handleCollectActionState(session, rawValue);

      case 'AUTHORIZATION_RESULT':
        return this.handleAuthorizationResultMenu(session, rawValue);

      case 'REPORT_MENU':
      case 'REPORTING':
        return this.handleReportMenuState(session, rawValue);

      case 'REFERENCE':
      case 'END':
        return {
          sessionId: session.sessionId,
          state: session.state,
          status: session.status,
          prompt: prompts.hangup
        };

      default:
        session.state = 'MENU';
        await ivrSessionManager.saveSession(session);
        return {
          sessionId: session.sessionId,
          state: 'MENU',
          status: session.status,
          prompt: prompts.mainMenu
        };
    }
  }

  /**
   * Handle Main Menu Selection
   */
  private async handleMenuState(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const digit = normalizeDtmfDigit(input);

    if (digit === '1') {
      session.state = 'COLLECT_OFFICER_CODE';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.collectOfficerCode,
        options: ['Enter Officer Code (e.g. TG-OFF-001 or 001)']
      };
    }

    if (digit === '2') {
      if (!session.officerReference) {
        // Enforce prerequisite: Must verify officer before action check
        session.state = 'COLLECT_OFFICER_CODE';
        await ivrSessionManager.saveSession(session);
        return {
          sessionId: session.sessionId,
          state: session.state,
          status: session.status,
          prompt: `Please verify an officer first before checking an action. ${prompts.collectOfficerCode}`
        };
      }
      session.state = 'COLLECT_ACTION';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.actionMenu,
        options: ['1: UPI Payment', '2: OTP/PIN Request', '3: Remote Screen Access', '4: Document Request']
      };
    }

    if (digit === '3') {
      session.state = 'REPORT_MENU';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.reportMenu,
        options: ['1: Payment demand', '2: OTP/PIN request', '3: Impersonation', '4: Threat/Coercion', '5: Other']
      };
    }

    // Invalid menu option
    const allowed = await ivrSessionManager.recordAttempt(session, MAX_MENU_ATTEMPTS);
    if (!allowed) {
      await logAudit({
        actorId: session.callerReference || 'IVR_CALLER',
        action: 'IVR_SESSION_LOCKED',
        entityType: 'IVR_SESSION',
        entityId: session.sessionId,
        metadata: { reason: 'EXCESSIVE_MENU_ATTEMPTS' }
      });
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: 'LOCKED',
        prompt: prompts.sessionLocked
      };
    }

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: `Invalid option. ${prompts.mainMenu}`,
      attemptCount: session.attemptCount
    };
  }

  /**
   * Handle Officer Code Keypad Input & Phase 7 Verification
   */
  private async handleCollectOfficerCodeState(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const norm = normalizeOfficerCode(input);

    if (!norm.valid || !norm.code) {
      const allowed = await ivrSessionManager.recordAttempt(session, MAX_OFFICER_ATTEMPTS);
      if (!allowed) {
        await logAudit({
          actorId: session.callerReference || 'IVR_CALLER',
          action: 'IVR_SESSION_LOCKED',
          entityType: 'IVR_SESSION',
          entityId: session.sessionId,
          metadata: { reason: 'EXCESSIVE_OFFICER_ATTEMPTS' }
        });
        return {
          sessionId: session.sessionId,
          state: session.state,
          status: 'LOCKED',
          prompt: prompts.sessionLocked
        };
      }
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.identityFailed,
        attemptCount: session.attemptCount
      };
    }

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_OFFICER_CODE_SUBMITTED',
      entityType: 'IVR_SESSION',
      entityId: session.sessionId,
      metadata: { code: norm.code }
    });

    // Invoke Phase 7 Verification Bridge
    const verification = await verifyOfficerForIvr(norm.code, session.callerReference);

    session.officerReference = verification.officerReference;
    session.verificationReference = verification.verificationReference;

    if (verification.result === 'VERIFIED') {
      session.state = 'IDENTITY_RESULT';
      await ivrSessionManager.saveSession(session);
      const spokenPrompt = `${verification.prompt} ${prompts.verificationReference(formatSpokenReference(verification.verificationReference))}`;
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: spokenPrompt,
        verificationResult: verification.result,
        verificationReference: verification.verificationReference,
        attemptCount: session.attemptCount,
        options: ['2: Check Requested Action', '3: Report Interaction', '9: End Call']
      };
    }

    if (verification.result === 'INCOMPLETE') {
      session.state = 'IDENTITY_RESULT';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: verification.prompt,
        verificationResult: verification.result,
        verificationReference: verification.verificationReference,
        attemptCount: session.attemptCount,
        options: ['2: Check Requested Action', '3: Report Interaction', '9: End Call']
      };
    }

    // FAILED / SUSPENDED / REVOKED / EXPIRED: Count as invalid verification attempt
    const allowed = await ivrSessionManager.recordAttempt(session, MAX_OFFICER_ATTEMPTS);
    if (!allowed) {
      await logAudit({
        actorId: session.callerReference || 'IVR_CALLER',
        action: 'IVR_SESSION_LOCKED',
        entityType: 'IVR_SESSION',
        entityId: session.sessionId,
        metadata: { reason: 'EXCESSIVE_OFFICER_ATTEMPTS' }
      });
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: 'LOCKED',
        prompt: prompts.sessionLocked,
        attemptCount: session.attemptCount
      };
    }

    session.state = 'COLLECT_OFFICER_CODE';
    await ivrSessionManager.saveSession(session);

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: verification.prompt,
      verificationResult: verification.result,
      verificationReference: verification.verificationReference,
      attemptCount: session.attemptCount,
      options: ['Enter Officer Code (e.g. TG-OFF-001)', '3: Report Interaction', '9: End Call']
    };
  }

  /**
   * Handle Post-Identity Menu Transitions
   */
  private async handleIdentityResultMenu(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const digit = normalizeDtmfDigit(input);

    if (digit === '1') {
      session.state = 'COLLECT_OFFICER_CODE';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.collectOfficerCode
      };
    }

    if (digit === '2') {
      session.state = 'COLLECT_ACTION';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.actionMenu,
        options: ['1: UPI Payment', '2: OTP/PIN Request', '3: Remote Access', '4: Document Request']
      };
    }

    if (digit === '3') {
      session.state = 'REPORT_MENU';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.reportMenu
      };
    }

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: `Press 2 to check a requested action. Press 3 to report this interaction. Press 9 to end.`
    };
  }

  /**
   * Handle Action Selection & Phase 8 Authorization Evaluation
   */
  private async handleCollectActionState(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const digit = normalizeDtmfDigit(input);

    // Map keypad DTMF digits to Phase 8 Action Codes
    const dtmfToAction: Record<string, string> = {
      '1': 'REQUEST_UPI_PAYMENT',
      '2': 'REQUEST_OTP',
      '3': 'REQUEST_REMOTE_ACCESS',
      '4': 'REQUEST_DOCUMENT'
    };

    let actionCode = dtmfToAction[digit || ''] || input.trim().toUpperCase();

    if (!isValidActionCode(actionCode)) {
      const allowed = await ivrSessionManager.recordAttempt(session, MAX_ACTION_ATTEMPTS);
      if (!allowed) {
        await logAudit({
          actorId: session.callerReference || 'IVR_CALLER',
          action: 'IVR_SESSION_LOCKED',
          entityType: 'IVR_SESSION',
          entityId: session.sessionId,
          metadata: { reason: 'EXCESSIVE_ACTION_ATTEMPTS' }
        });
        return {
          sessionId: session.sessionId,
          state: session.state,
          status: 'LOCKED',
          prompt: prompts.sessionLocked
        };
      }
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.authUnrecognized,
        attemptCount: session.attemptCount
      };
    }

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_AUTHORIZATION_REQUESTED',
      entityType: 'IVR_SESSION',
      entityId: session.sessionId,
      metadata: {
        officerReference: session.officerReference,
        actionCode
      }
    });

    // Invoke Phase 8 Authorization Engine
    const authResult = await authorizationEngine.evaluate({
      officerReference: session.officerReference || 'TG-OFF-001',
      actionCode: actionCode as any,
      requestContext: { communicationChannel: 'VERIFIED_PHONE' }
    });

    session.authorizationReference = authResult.evaluationId;
    session.state = 'AUTHORIZATION_RESULT';
    await ivrSessionManager.saveSession(session);

    // Map Phase 8 Decision and Risk to Voice-Friendly Guidance
    let safetyPrompt = prompts.authAllow;
    if (authResult.decision === 'DENY') {
      safetyPrompt = authResult.riskLevel === 'CRITICAL' ? prompts.authDenyCritical : prompts.authDenyHigh;
    } else if (authResult.decision === 'REVIEW') {
      safetyPrompt = prompts.authReview;
    }

    const spokenRef = formatSpokenReference(authResult.evaluationId);
    const finalPrompt = `${safetyPrompt} Your authorization evaluation reference is ${spokenRef}. Press 3 to report this interaction. Press 9 to end.`;

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_AUTHORIZATION_COMPLETED',
      entityType: 'IVR_SESSION',
      entityId: session.sessionId,
      metadata: {
        evaluationId: authResult.evaluationId,
        decision: authResult.decision,
        riskLevel: authResult.riskLevel
      }
    });

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: finalPrompt,
      authorizationResult: authResult.decision,
      riskLevel: authResult.riskLevel,
      authorizationReference: authResult.evaluationId,
      options: ['3: Report this interaction', '9: End Call']
    };
  }

  /**
   * Handle Post-Authorization Menu Transitions
   */
  private async handleAuthorizationResultMenu(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const digit = normalizeDtmfDigit(input);

    if (digit === '1') {
      session.state = 'COLLECT_OFFICER_CODE';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.collectOfficerCode
      };
    }

    if (digit === '2') {
      session.state = 'COLLECT_ACTION';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.actionMenu
      };
    }

    if (digit === '3') {
      session.state = 'REPORT_MENU';
      await ivrSessionManager.saveSession(session);
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: prompts.reportMenu
      };
    }

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: `Press 3 to report this interaction. Press 9 to end.`
    };
  }

  /**
   * Handle Suspicious Interaction Reporting (Phase 9 Integration)
   */
  private async handleReportMenuState(session: IvrSession, input: string): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    const digit = normalizeDtmfDigit(input);

    const categoryMap: Record<string, ReportCategoryCode> = {
      '1': 'PAYMENT_DEMAND',
      '2': 'OTP_REQUEST',
      '3': 'IMPERSONATION',
      '4': 'THREAT_OR_COERCION',
      '5': 'OTHER'
    };

    let selectedCategory: ReportCategoryCode | null = categoryMap[digit || ''] || null;

    if (!selectedCategory && isValidReportCategory(input.trim().toUpperCase())) {
      selectedCategory = input.trim().toUpperCase() as ReportCategoryCode;
    }

    if (!selectedCategory) {
      return {
        sessionId: session.sessionId,
        state: session.state,
        status: session.status,
        prompt: `Invalid selection. ${prompts.reportMenu}`,
        options: ['1: Payment demand', '2: OTP/PIN request', '3: Impersonation', '4: Threat/Coercion', '5: Other']
      };
    }

    // Resolve an authenticated demo citizen or system citizen id for database storage
    let citizenId = 'citizen-u-id-1';
    try {
      const citizenUser = await pool.query("SELECT id FROM users WHERE role = 'CITIZEN' LIMIT 1");
      if (citizenUser.rows.length > 0) {
        citizenId = citizenUser.rows[0].id;
      }
    } catch {}

    // Create Report via Phase 9 reportService
    const report = await reportService.createReport(
      {
        reportCategory: selectedCategory,
        description: `Suspicious interaction reported via TrustGov IVR voice gateway. Category selected: ${selectedCategory}.`,
        officerReference: session.officerReference || undefined,
        verificationReference: session.verificationReference || undefined,
        authorizationEvaluationReference: session.authorizationReference || undefined
      },
      citizenId
    );

    session.reportReference = report.reportId;
    session.state = 'REFERENCE';
    await ivrSessionManager.saveSession(session);

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_REPORT_CREATED',
      entityType: 'IVR_REPORT',
      entityId: report.reportId,
      metadata: {
        category: selectedCategory,
        officerReference: session.officerReference,
        verificationReference: session.verificationReference
      }
    });

    const spokenRef = formatSpokenReference(report.reportId);
    const confirmationPrompt = `${prompts.reportSubmitted(spokenRef)} ${prompts.repeatHelp}`;

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt: confirmationPrompt,
      reportReference: report.reportId,
      options: ['0: Repeat Reference', '9: End Call']
    };
  }

  /**
   * Repeat Prompt for Current Session State
   */
  async repeatPrompt(session: IvrSession): Promise<IvrSessionResponse> {
    const prompts = getPrompts('en-IN');
    let prompt = prompts.mainMenu;

    switch (session.state) {
      case 'WELCOME':
      case 'MENU':
        prompt = `${prompts.welcome} ${prompts.mainMenu}`;
        break;
      case 'COLLECT_OFFICER_CODE':
        prompt = prompts.collectOfficerCode;
        break;
      case 'IDENTITY_RESULT':
        prompt = prompts.identityVerified;
        if (session.verificationReference) {
          prompt += ` ${prompts.verificationReference(formatSpokenReference(session.verificationReference))}`;
        }
        break;
      case 'ACTION_MENU':
      case 'COLLECT_ACTION':
        prompt = prompts.actionMenu;
        break;
      case 'AUTHORIZATION_RESULT':
        prompt = `Authorization evaluation complete. Press 3 to report. Press 9 to end.`;
        break;
      case 'REPORT_MENU':
        prompt = prompts.reportMenu;
        break;
      case 'REFERENCE':
        if (session.reportReference) {
          prompt = prompts.reportSubmitted(formatSpokenReference(session.reportReference));
        } else if (session.verificationReference) {
          prompt = prompts.verificationReference(formatSpokenReference(session.verificationReference));
        }
        break;
      case 'END':
        prompt = prompts.hangup;
        break;
    }

    return {
      sessionId: session.sessionId,
      state: session.state,
      status: session.status,
      prompt,
      verificationReference: session.verificationReference,
      authorizationReference: session.authorizationReference,
      reportReference: session.reportReference
    };
  }

  /**
   * End Session manually
   */
  async endCall(sessionId: string): Promise<IvrSessionResponse> {
    const session = await ivrSessionManager.getSession(sessionId);
    const prompts = getPrompts('en-IN');

    if (!session) {
      throw {
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found.'
      };
    }

    await ivrSessionManager.completeSession(session);

    await logAudit({
      actorId: session.callerReference || 'IVR_CALLER',
      action: 'IVR_SESSION_COMPLETED',
      entityType: 'IVR_SESSION',
      entityId: session.sessionId,
      metadata: { terminatedBy: 'CALLER_HANGUP' }
    });

    return {
      sessionId: session.sessionId,
      state: 'END',
      status: 'COMPLETED',
      prompt: prompts.hangup
    };
  }

  /**
   * Get Current Session Status
   */
  async getStatus(sessionId: string): Promise<IvrSessionResponse> {
    const session = await ivrSessionManager.getSession(sessionId);
    if (!session) {
      throw {
        statusCode: 404,
        code: 'SESSION_NOT_FOUND',
        message: 'Session not found.'
      };
    }
    return this.repeatPrompt(session);
  }

  /**
   * Reset Simulator state (Development / Demo only)
   */
  async resetSimulator(): Promise<{ success: boolean; message: string }> {
    await pool.query('DELETE FROM ivr_sessions');
    return { success: true, message: 'IVR simulator state reset successfully.' };
  }

  /**
   * Manually expire a session (Development / Test only)
   */
  async expireSimulatorSession(sessionId: string): Promise<IvrSessionResponse> {
    const session = await ivrSessionManager.getSession(sessionId);
    if (!session) {
      throw { statusCode: 404, code: 'SESSION_NOT_FOUND', message: 'Session not found.' };
    }
    session.status = 'EXPIRED';
    session.expiresAt = new Date(Date.now() - 1000);
    await ivrSessionManager.saveSession(session);
    return {
      sessionId: session.sessionId,
      state: session.state,
      status: 'EXPIRED',
      prompt: getPrompts('en-IN').sessionExpired
    };
  }
}

export const ivrService = new IvrService();
