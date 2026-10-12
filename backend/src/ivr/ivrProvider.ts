/**
 * TRUSTGOV - PHASE 10: IVR TELEPHONY PROVIDER ABSTRACTION
 * 
 * Defines provider-agnostic telephony interface.
 * Isolates TrustGov business logic from commercial vendors (Twilio, Exotel, Plivo, etc.).
 */

import { IvrStartCallRequest } from './ivrTypes';

export interface TelephonyCallSession {
  callId: string;
  provider: string;
  status: 'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  callerToken?: string | null;
  startedAt: Date;
  endedAt?: Date | null;
}

export interface IvrProvider {
  readonly name: string;

  /**
   * Initialize a new incoming or outgoing call connection
   */
  startCall(request: IvrStartCallRequest): Promise<TelephonyCallSession>;

  /**
   * Instruct telephony gateway to speak or play an audio prompt
   */
  playPrompt(callId: string, promptText: string): Promise<void>;

  /**
   * Instruct gateway to collect DTMF keypad digits from caller
   */
  collectDigits(callId: string, config?: { maxDigits?: number; timeoutSec?: number; finishOnKey?: string }): Promise<string | null>;

  /**
   * Terminate call connection
   */
  hangup(callId: string): Promise<void>;
}
