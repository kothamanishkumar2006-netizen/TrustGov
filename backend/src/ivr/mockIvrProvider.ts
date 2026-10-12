/**
 * TRUSTGOV - PHASE 10: MOCK IVR TELEPHONY PROVIDER
 * 
 * Provides deterministic in-memory telephony simulation for local development and test suites.
 * Eliminates need for paid carrier APIs or external telephony hardware.
 */

import crypto from 'crypto';
import { IvrProvider, TelephonyCallSession } from './ivrProvider';
import { IvrStartCallRequest } from './ivrTypes';
import { tokenizeCallerPhone } from './ivrSecurity';

export class MockIvrProvider implements IvrProvider {
  readonly name = 'MockIvrProvider';
  private calls: Map<string, TelephonyCallSession> = new Map();
  private promptHistory: Map<string, string[]> = new Map();

  async startCall(request: IvrStartCallRequest): Promise<TelephonyCallSession> {
    const callId = `mock-call-${crypto.randomBytes(6).toString('hex')}`;
    const callerToken = tokenizeCallerPhone(request.callerId);

    const session: TelephonyCallSession = {
      callId,
      provider: this.name,
      status: 'IN_PROGRESS',
      callerToken,
      startedAt: new Date(),
      endedAt: null
    };

    this.calls.set(callId, session);
    this.promptHistory.set(callId, []);

    return session;
  }

  async playPrompt(callId: string, promptText: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call) return;
    const history = this.promptHistory.get(callId) || [];
    history.push(promptText);
    this.promptHistory.set(callId, history);
  }

  async collectDigits(callId: string, _config?: { maxDigits?: number; timeoutSec?: number; finishOnKey?: string }): Promise<string | null> {
    const call = this.calls.get(callId);
    if (!call || call.status !== 'IN_PROGRESS') return null;
    return null;
  }

  async hangup(callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (call) {
      call.status = 'COMPLETED';
      call.endedAt = new Date();
    }
  }

  // Developer / Simulator utilities
  getCall(callId: string): TelephonyCallSession | undefined {
    return this.calls.get(callId);
  }

  getPromptHistory(callId: string): string[] {
    return this.promptHistory.get(callId) || [];
  }

  reset(): void {
    this.calls.clear();
    this.promptHistory.clear();
  }
}

export const mockIvrProvider = new MockIvrProvider();
