/**
 * TRUSTGOV - PHASE 10: IVR VOICE PROMPT CATALOG (ACCESSIBILITY FIRST)
 * 
 * Provides voice-friendly, neutral, non-sensationalized spoken prompts.
 * Adheres strictly to TrustGov prototype safety guidelines:
 * - Neutral evaluation (no "You are safe" or "TrustGov guarantees legitimacy")
 * - Anti-scam warnings on critical demands
 * - Anti-enumeration phrasing (generic failure)
 * - Phonetic readout of references for audio clarity
 * - Extensible structure for future internationalization (hi-IN, te-IN)
 */

export interface IvrPromptBundle {
  welcome: string;
  mainMenu: string;
  collectOfficerCode: string;
  verifyingIdentity: string;
  identityVerified: string;
  identityFailed: string;
  identityIncomplete: string;
  identitySuspended: string;
  identityRevoked: string;
  identityExpired: string;
  actionMenu: string;
  collectAction: string;
  authorizingAction: string;
  authDenyCritical: string;
  authDenyHigh: string;
  authReview: string;
  authAllow: string;
  authUnrecognized: string;
  reportMenu: string;
  reportSubmitted: (spokenRef: string) => string;
  verificationReference: (spokenRef: string) => string;
  sessionExpired: string;
  sessionLocked: string;
  genericError: string;
  hangup: string;
  repeatHelp: string;
}

/**
 * Phonetically formats reference for clear telephone audio synthesis
 * e.g. "TG-IVR-AB12CD34" -> "TEE GEE DASH EYE VEE AHR DASH A B 1 2 C D 3 4"
 */
export function formatSpokenReference(ref: string): string {
  if (!ref) return '';
  const NATO: Record<string, string> = {
    'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F',
    'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J', 'K': 'K', 'L': 'L',
    'M': 'M', 'N': 'N', 'O': 'O', 'P': 'P', 'Q': 'Q', 'R': 'R',
    'S': 'S', 'T': 'T', 'U': 'U', 'V': 'V', 'W': 'W', 'X': 'X',
    'Y': 'Y', 'Z': 'Z',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    '-': ' DASH '
  };

  return ref
    .toUpperCase()
    .split('')
    .map(ch => NATO[ch] || ch)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const PROMPTS_EN_IN: IvrPromptBundle = {
  welcome: 'Welcome to the TrustGov demonstration verification service.',
  
  mainMenu:
    'Press 1 to verify an officer. Press 2 to check a requested action. Press 3 to report a suspicious interaction. Press 9 to end.',

  collectOfficerCode:
    'Please enter the officer code followed by the hash key. For example, enter 0 0 1 for demo officer 1.',

  verifyingIdentity:
    'Please wait while we verify the officer identity against the TrustGov demonstration registry.',

  identityVerified:
    'The officer identity has been successfully verified. To check whether a requested action is authorized, press 2. To report this interaction, press 3. To end, press 9.',

  identityFailed:
    'We could not verify that officer code. Do not provide money, passwords, PINs, or one-time passwords based only on this request. Press 1 to try another code, or press 3 to report this interaction.',

  identityIncomplete:
    'The officer identity record was found, but live possession verification could not be completed through this phone verification method. Please use the TrustGov web verification service for additional cryptographic verification.',

  identitySuspended:
    'The officer identity cannot currently be verified because the record is suspended.',

  identityRevoked:
    'The officer identity cannot currently be verified because the official credential has been revoked.',

  identityExpired:
    'The officer credential is no longer valid.',

  actionMenu:
    'To check a requested action: Press 1 for UPI or payment transfer. Press 2 for OTP or PIN request. Press 3 for remote screen access. Press 4 for document request. Press 9 to end.',

  collectAction:
    'Enter the action code or press a menu number.',

  authorizingAction:
    'Please wait while we evaluate the requested action against TrustGov demonstration safety policies.',

  authDenyCritical:
    'This request is not authorized by the TrustGov demonstration policy. Do not provide money, passwords, PINs, or one-time passwords based only on this request. TrustGov and genuine law enforcement will never ask you to transfer funds to verify yourself.',

  authDenyHigh:
    'This request could not be authorized by the TrustGov demonstration policy. Do not proceed until you independently verify the request with official departmental authorities.',

  authReview:
    'This request requires additional official written verification before proceeding. Do not take immediate action.',

  authAllow:
    'This request is permitted under the current TrustGov demonstration policy. Continue to verify the context before taking action.',

  authUnrecognized:
    'We cannot evaluate that request through the TrustGov demonstration service.',

  reportMenu:
    'Select the type of suspicious interaction: Press 1 for payment demand. Press 2 for OTP or PIN request. Press 3 for impersonation. Press 4 for threat or coercion. Press 5 for another suspicious request.',

  reportSubmitted: (spokenRef: string) =>
    `Your report has been submitted. Your report reference is ${spokenRef}. You can use this reference later through the TrustGov web interface to provide additional information or evidence.`,

  verificationReference: (spokenRef: string) =>
    `Your verification reference is ${spokenRef}.`,

  sessionExpired:
    'Your TrustGov verification session has expired. Please start a new verification.',

  sessionLocked:
    'For security reasons, this verification session has been locked due to excessive failed attempts.',

  genericError:
    'We could not complete your request. Please try again later.',

  hangup:
    'Thank you for using the TrustGov demonstration verification service. Goodbye.',

  repeatHelp:
    'Press 0 to repeat this message. Press 9 to end the call.'
};

/**
 * Locale prompt accessor with fallback to en-IN
 */
export function getPrompts(locale = 'en-IN'): IvrPromptBundle {
  // Locale fallback - future hi-IN, te-IN can be mounted here
  return PROMPTS_EN_IN;
}
