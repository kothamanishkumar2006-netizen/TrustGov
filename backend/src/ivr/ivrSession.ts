/**
 * TRUSTGOV - PHASE 10: IVR SESSION REPOSITORY & LIFECYCLE MANAGER
 * 
 * Manages secure server-side IVR session state, expiration, attempt tracking, and persistence.
 * Implements strict tenant safety and zero client-manipulated state.
 */

import crypto from 'crypto';
import { pool } from '../config/db';
import { IvrSession, IvrSessionState, IvrSessionStatus } from './ivrTypes';
import {
  generateIvrSessionId,
  tokenizeCallerPhone,
  IVR_SESSION_TTL_MS,
  MAX_OVERALL_ATTEMPTS
} from './ivrSecurity';

export class IvrSessionManager {
  /**
   * Create a new secure IVR session
   */
  async createSession(callerPhone?: string | null): Promise<IvrSession> {
    const id = `ivr-uuid-${crypto.randomBytes(8).toString('hex')}`;
    const sessionId = generateIvrSessionId();
    const state: IvrSessionState = 'WELCOME';
    const status: IvrSessionStatus = 'ACTIVE';
    const callerReference = tokenizeCallerPhone(callerPhone);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + IVR_SESSION_TTL_MS);
    const lastActivityAt = new Date();
    const attemptCount = 0;
    const maxAttempts = MAX_OVERALL_ATTEMPTS;

    const query = `
      INSERT INTO ivr_sessions (
        id, session_id, state, status, caller_reference, officer_reference,
        verification_reference, authorization_reference, report_reference,
        attempt_count, max_attempts, created_at, expires_at, last_activity_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    await pool.query(query, [
      id,
      sessionId,
      state,
      status,
      callerReference,
      null, // officer_reference
      null, // verification_reference
      null, // authorization_reference
      null, // report_reference
      attemptCount,
      maxAttempts,
      createdAt,
      expiresAt,
      lastActivityAt,
      null // completed_at
    ]);

    return {
      id,
      sessionId,
      state,
      status,
      callerReference,
      officerReference: null,
      verificationReference: null,
      authorizationReference: null,
      reportReference: null,
      attemptCount,
      maxAttempts,
      createdAt,
      expiresAt,
      lastActivityAt,
      completedAt: null
    };
  }

  /**
   * Retrieve and evaluate IVR session by public session reference
   */
  async getSession(sessionId: string): Promise<IvrSession | null> {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const res = await pool.query('SELECT * FROM ivr_sessions WHERE session_id = $1 LIMIT 1', [sessionId.trim()]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const session: IvrSession = {
      id: row.id,
      sessionId: row.session_id,
      state: row.state as IvrSessionState,
      status: row.status as IvrSessionStatus,
      callerReference: row.caller_reference,
      officerReference: row.officer_reference,
      verificationReference: row.verification_reference,
      authorizationReference: row.authorization_reference,
      reportReference: row.report_reference,
      attemptCount: Number(row.attempt_count || 0),
      maxAttempts: Number(row.max_attempts || MAX_OVERALL_ATTEMPTS),
      createdAt: new Date(row.created_at),
      expiresAt: new Date(row.expires_at),
      lastActivityAt: new Date(row.last_activity_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : null
    };

    // Evaluate TTL expiration on retrieval
    if (session.status === 'ACTIVE' && Date.now() > session.expiresAt.getTime()) {
      session.status = 'EXPIRED';
      await this.saveSession(session);
    }

    return session;
  }

  /**
   * Save session modifications back to authoritative storage
   */
  async saveSession(session: IvrSession): Promise<IvrSession> {
    session.lastActivityAt = new Date();

    const query = `
      UPDATE ivr_sessions
      SET state = $1,
          status = $2,
          officer_reference = $3,
          verification_reference = $4,
          authorization_reference = $5,
          report_reference = $6,
          attempt_count = $7,
          last_activity_at = $8,
          completed_at = $9
      WHERE session_id = $10
      RETURNING *
    `;

    await pool.query(query, [
      session.state,
      session.status,
      session.officerReference || null,
      session.verificationReference || null,
      session.authorizationReference || null,
      session.reportReference || null,
      session.attemptCount,
      session.lastActivityAt,
      session.completedAt || null,
      session.sessionId
    ]);

    return session;
  }

  /**
   * Increment attempt counter and lock if threshold exceeded
   */
  async recordAttempt(session: IvrSession, threshold = session.maxAttempts): Promise<boolean> {
    session.attemptCount += 1;
    if (session.attemptCount >= threshold) {
      session.status = 'LOCKED';
      await this.saveSession(session);
      return false; // locked
    }
    await this.saveSession(session);
    return true; // continue
  }

  /**
   * Mark session completed and record completion timestamp
   */
  async completeSession(session: IvrSession): Promise<IvrSession> {
    session.status = 'COMPLETED';
    session.state = 'END';
    session.completedAt = new Date();
    return this.saveSession(session);
  }

  /**
   * Lock session immediately
   */
  async lockSession(session: IvrSession): Promise<IvrSession> {
    session.status = 'LOCKED';
    return this.saveSession(session);
  }
}

export const ivrSessionManager = new IvrSessionManager();
