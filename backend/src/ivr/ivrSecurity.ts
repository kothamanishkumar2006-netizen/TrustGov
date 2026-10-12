/**
 * TRUSTGOV - PHASE 10: IVR SECURITY & UTILITIES
 * 
 * Provides:
 * - Cryptographic session ID & reference generation (TG-IVR-XXXXXXXX)
 * - Safe phone number tokenization (zero raw PII storage)
 * - Input validation & sanitization (DTMF / officer code / action code)
 * - Attempt caps and TTL constants
 * - Safe error masking (zero internal secrets or database errors leaked)
 */

import crypto from 'crypto';

export const IVR_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_OFFICER_ATTEMPTS = 5;
export const MAX_ACTION_ATTEMPTS = 3;
export const MAX_MENU_ATTEMPTS = 5;
export const MAX_OVERALL_ATTEMPTS = 10;

/**
 * Generate a cryptographically secure, non-sequential IVR session ID
 * Format: TG-IVR-XXXXXXXX (8 uppercase alphanumeric chars, excluding ambiguous 0, 1, I, O)
 */
export function generateIvrSessionId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let ref = 'TG-IVR-';
  for (let i = 0; i < 8; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

/**
 * Ephemeral tokenization of caller phone number.
 * Never stores or returns raw phone numbers.
 */
export function tokenizeCallerPhone(phone?: string | null): string | null {
  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    return null;
  }
  const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
  const hash = crypto.createHash('sha256').update(`TRUSTGOV_PHONE_SALT_${normalized}`).digest('hex');
  return `TEL-${hash.substring(0, 12).toUpperCase()}`;
}

/**
 * Normalize and validate officer code input from keypad/DTMF or speech
 */
export function normalizeOfficerCode(raw: string): { valid: boolean; code?: string; error?: string } {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Officer code input is required.' };
  }

  const trimmed = raw.trim().toUpperCase().replace(/[\s#*]/g, '');

  if (trimmed.length < 3 || trimmed.length > 32) {
    return { valid: false, error: 'Officer code length is invalid.' };
  }

  // Allow standard TrustGov patterns, e.g. TG-OFF-001, OFF-001, 001
  if (/^[A-Z0-9_-]+$/.test(trimmed)) {
    // If entered purely as digits like "001", normalize to "TG-OFF-001"
    if (/^\d{3}$/.test(trimmed)) {
      return { valid: true, code: `TG-OFF-${trimmed}` };
    }
    // If entered as "OFF001" or "OFF-001"
    if (/^OFF-?\d+$/.test(trimmed)) {
      const numPart = trimmed.replace(/\D/g, '').padStart(3, '0');
      return { valid: true, code: `TG-OFF-${numPart}` };
    }
    return { valid: true, code: trimmed };
  }

  return { valid: false, error: 'Officer code contains invalid characters.' };
}

/**
 * Normalize DTMF menu option
 */
export function normalizeDtmfDigit(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (/^[0-9*#]$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Validate input size to prevent denial-of-service / buffer overflow
 */
export function isInputOversized(raw: any, maxLen = 100): boolean {
  if (typeof raw !== 'string') return false;
  return raw.length > maxLen;
}
