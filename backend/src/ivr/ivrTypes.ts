/**
 * TRUSTGOV - PHASE 10: IVR ACCESSIBILITY & PHONE VERIFICATION TYPES
 * 
 * Defines states, statuses, DTOs, and interfaces for the TrustGov IVR Voice Gateway.
 */

export type IvrSessionState =
  | 'WELCOME'
  | 'MENU'
  | 'COLLECT_OFFICER_CODE'
  | 'VERIFYING_IDENTITY'
  | 'IDENTITY_RESULT'
  | 'ACTION_MENU'
  | 'COLLECT_ACTION'
  | 'AUTHORIZING_ACTION'
  | 'AUTHORIZATION_RESULT'
  | 'REPORT_MENU'
  | 'REPORTING'
  | 'REFERENCE'
  | 'END';

export type IvrSessionStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'EXPIRED'
  | 'LOCKED'
  | 'FAILED'
  | 'CANCELLED';

export type IvrInputType = 'DTMF' | 'SPEECH';

export type IvrVerificationVoiceResult =
  | 'VERIFIED'
  | 'FAILED'
  | 'INCOMPLETE'
  | 'SUSPENDED'
  | 'REVOKED'
  | 'EXPIRED';

export interface IvrSession {
  id: string;
  sessionId: string; // e.g. TG-IVR-XXXXXXXX
  state: IvrSessionState;
  status: IvrSessionStatus;
  callerReference?: string | null;
  officerReference?: string | null;
  verificationReference?: string | null;
  authorizationReference?: string | null;
  reportReference?: string | null;
  attemptCount: number;
  maxAttempts: number;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  completedAt?: Date | null;
}

export interface IvrInputRequest {
  inputType: IvrInputType;
  value: string;
}

export interface IvrSessionResponse {
  sessionId: string;
  state: IvrSessionState;
  status: IvrSessionStatus;
  prompt: string;
  options?: string[];
  verificationResult?: IvrVerificationVoiceResult;
  verificationReference?: string | null;
  authorizationResult?: 'ALLOW' | 'DENY' | 'REVIEW';
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  authorizationReference?: string | null;
  reportReference?: string | null;
  attemptCount?: number;
  maxAttempts?: number;
  expiresAt?: string;
}

export interface IvrStartCallRequest {
  callerId?: string; // Optional raw phone number (will be pseudonymized / tokenized immediately)
  language?: string; // e.g. 'en-IN'
}
