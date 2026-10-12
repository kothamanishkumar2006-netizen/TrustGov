/**
 * TRUSTGOV - PHASE 8: CENTRALIZED REASON CODES
 * Deterministic machine-readable reason codes with human-readable citizen and technical explanations.
 */

import { ReasonDefinition, ReasonSeverity } from '../types/authorization';

export const REASON_CATALOG: Record<string, ReasonDefinition> = {
  IDENTITY_NOT_VERIFIED: {
    code: 'IDENTITY_NOT_VERIFIED',
    title: 'Officer Identity Not Verified',
    citizenMessage: 'The officer could not be verified against official records. Do not comply with any requests.',
    technicalMessage: 'Officer resolution or identity verification checks failed or were not completed.',
    severity: 'CRITICAL'
  },
  OFFICER_INACTIVE: {
    code: 'OFFICER_INACTIVE',
    title: 'Officer Inactive',
    citizenMessage: 'The officer is currently marked inactive in official government service records.',
    technicalMessage: 'Officer account status is not ACTIVE in government officer registry.',
    severity: 'HIGH'
  },
  OFFICER_SUSPENDED: {
    code: 'OFFICER_SUSPENDED',
    title: 'Officer Under Suspension',
    citizenMessage: 'This officer is under administrative suspension and has NO official authority to contact citizens.',
    technicalMessage: 'Officer lifecycle status is SUSPENDED. All administrative and operational powers are revoked.',
    severity: 'CRITICAL'
  },
  OFFICER_REVOKED: {
    code: 'OFFICER_REVOKED',
    title: 'Officer Revoked / Dismissed',
    citizenMessage: 'This individual has been permanently revoked or dismissed from government service.',
    technicalMessage: 'Officer lifecycle status is REVOKED. Subject has permanently lost all officer authority.',
    severity: 'CRITICAL'
  },
  CREDENTIAL_INVALID: {
    code: 'CREDENTIAL_INVALID',
    title: 'Digital Credential Invalid',
    citizenMessage: 'The cryptographic digital credential of this officer failed digital signature verification.',
    technicalMessage: 'W3C Verifiable Credential Ed25519 signature is tampered or cryptographically invalid.',
    severity: 'CRITICAL'
  },
  CREDENTIAL_SUSPENDED: {
    code: 'CREDENTIAL_SUSPENDED',
    title: 'Credential Suspended',
    citizenMessage: 'The digital credential presented has been temporarily suspended by departmental authorities.',
    technicalMessage: 'Verifiable Credential status is SUSPENDED.',
    severity: 'HIGH'
  },
  CREDENTIAL_REVOKED: {
    code: 'CREDENTIAL_REVOKED',
    title: 'Credential Permanently Revoked',
    citizenMessage: 'The digital credential presented is permanently revoked and invalid.',
    technicalMessage: 'Verifiable Credential status is REVOKED.',
    severity: 'CRITICAL'
  },
  CREDENTIAL_EXPIRED: {
    code: 'CREDENTIAL_EXPIRED',
    title: 'Credential Expired',
    citizenMessage: 'The digital credential presented has passed its validity expiration date.',
    technicalMessage: 'Verifiable Credential validUntil timestamp is in the past.',
    severity: 'HIGH'
  },
  PROOF_OF_POSSESSION_FAILED: {
    code: 'PROOF_OF_POSSESSION_FAILED',
    title: 'Proof of Possession Failed',
    citizenMessage: 'Live cryptographic challenge-response failed. The person contacting you did not prove possession of the officer’s private key.',
    technicalMessage: 'Ed25519 challenge-response signature failed cryptographic verification or challenge timed out.',
    severity: 'CRITICAL'
  },
  BLOCKCHAIN_INTEGRITY_FAILED: {
    code: 'BLOCKCHAIN_INTEGRITY_FAILED',
    title: 'Blockchain Integrity Failed',
    citizenMessage: 'The officer credential does not match the immutable record registered on the government blockchain registry.',
    technicalMessage: 'Smart contract registry lookup on TrustGovRegistry.sol returned hash mismatch or unanchored status.',
    severity: 'CRITICAL'
  },
  ACTION_NOT_AUTHORIZED: {
    code: 'ACTION_NOT_AUTHORIZED',
    title: 'Action Not Authorized',
    citizenMessage: 'This requested action is explicitly NOT authorized for this officer under configured policies.',
    technicalMessage: 'Active authorization policy specifies DENY for this action and role combination.',
    severity: 'HIGH'
  },
  NO_ACTIVE_POLICY: {
    code: 'NO_ACTIVE_POLICY',
    title: 'No Active Policy Established',
    citizenMessage: 'Unable to establish authorization. No active TrustGov policy covers this specific requested action.',
    technicalMessage: 'No active authorization policy record found matching department, role, and action_code.',
    severity: 'MEDIUM'
  },
  POLICY_EXPIRED: {
    code: 'POLICY_EXPIRED',
    title: 'Authorization Policy Expired',
    citizenMessage: 'The authorization policy governing this action has expired and is pending administrative renewal.',
    technicalMessage: 'Matching policy record effective_to date has elapsed or policy status is EXPIRED.',
    severity: 'MEDIUM'
  },
  PERSONAL_PAYMENT_REQUEST: {
    code: 'PERSONAL_PAYMENT_REQUEST',
    title: 'Personal Payment Requested',
    citizenMessage: 'NEVER transfer money or scan personal UPI QR codes for government officers. Official government dues are paid exclusively through designated government billing portals.',
    technicalMessage: 'Requested payment destination (personal UPI, personal bank account) is outside authorized statutory payment workflows.',
    severity: 'CRITICAL'
  },
  OTP_REQUEST: {
    code: 'OTP_REQUEST',
    title: 'OTP Demanded',
    citizenMessage: 'CRITICAL WARNING: Government officers will NEVER ask for your One-Time Password (OTP). Sharing an OTP enables financial theft.',
    technicalMessage: 'REQUEST_OTP is classified as PROHIBITED under TrustGov safety rules.',
    severity: 'CRITICAL'
  },
  PIN_REQUEST: {
    code: 'PIN_REQUEST',
    title: 'PIN Demanded',
    citizenMessage: 'CRITICAL WARNING: Government officers will NEVER ask for your ATM, UPI, or security PIN. Never disclose this to anyone.',
    technicalMessage: 'REQUEST_PIN is classified as PROHIBITED under TrustGov safety rules.',
    severity: 'CRITICAL'
  },
  PASSWORD_REQUEST: {
    code: 'PASSWORD_REQUEST',
    title: 'Password Demanded',
    citizenMessage: 'CRITICAL WARNING: Government officers will NEVER ask for your passwords to any bank, email, or device.',
    technicalMessage: 'REQUEST_PASSWORD is classified as PROHIBITED under TrustGov safety rules.',
    severity: 'CRITICAL'
  },
  REMOTE_ACCESS_REQUEST: {
    code: 'REMOTE_ACCESS_REQUEST',
    title: 'Remote Screen Access Demanded',
    citizenMessage: 'HIGH RISK: Government officers do NOT ask citizens to install screen-sharing software (AnyDesk, TeamViewer, RustDesk, etc.). Doing so allows scammers to take over your phone.',
    technicalMessage: 'REQUEST_REMOTE_ACCESS is classified as PROHIBITED under TrustGov safety rules.',
    severity: 'HIGH'
  },
  SOFTWARE_INSTALL_REQUEST: {
    code: 'SOFTWARE_INSTALL_REQUEST',
    title: 'Software Installation Demanded',
    citizenMessage: 'HIGH RISK: Do not download or install APK files or software packages sent via messaging apps.',
    technicalMessage: 'REQUEST_SOFTWARE_INSTALLATION is classified as PROHIBITED under TrustGov safety rules.',
    severity: 'HIGH'
  },
  URGENT_PAYMENT_DEMAND: {
    code: 'URGENT_PAYMENT_DEMAND',
    title: 'Urgent Payment Demand',
    citizenMessage: 'CRITICAL RISK: Demand for immediate money transfer under threat of arrest is the hallmark of impersonation extortion.',
    technicalMessage: 'Combination of payment action and urgency=URGENT/IMMEDIATE triggers CRITICAL safety alert.',
    severity: 'CRITICAL'
  },
  THREAT_BASED_REQUEST: {
    code: 'THREAT_BASED_REQUEST',
    title: 'Threat / Digital Arrest Coercion',
    citizenMessage: 'WARNING: Indian law does not recognize "digital arrest" via video or phone calls. Government officers cannot place you under arrest remotely.',
    technicalMessage: 'Threat indicators or coercion detected in request context.',
    severity: 'CRITICAL'
  },
  OFFICIAL_CHANNEL_BYPASS: {
    code: 'OFFICIAL_CHANNEL_BYPASS',
    title: 'Official Channel Bypass',
    citizenMessage: 'CAUTION: This communication is happening over WhatsApp or personal phone rather than official portals or station visits.',
    technicalMessage: 'Communication channel (WHATSAPP, PERSONAL_PHONE) bypasses configured official channels.',
    severity: 'MEDIUM'
  },
  CHANNEL_NOT_PERMITTED: {
    code: 'CHANNEL_NOT_PERMITTED',
    title: 'Communication Channel Not Permitted',
    citizenMessage: 'This action is not authorized to be conducted through the communication channel currently being used.',
    technicalMessage: 'Active policy constraints restrict communication to specific authorized channels.',
    severity: 'HIGH'
  },
  DATA_CATEGORY_NOT_PERMITTED: {
    code: 'DATA_CATEGORY_NOT_PERMITTED',
    title: 'Requested Data Category Prohibited',
    citizenMessage: 'This officer is not authorized to request this category of information under the configured policy.',
    technicalMessage: 'Requested data category exceeds policy allowedDataCategories constraint.',
    severity: 'HIGH'
  },
  AUTHENTICATION_SECRET_REQUESTED: {
    code: 'AUTHENTICATION_SECRET_REQUESTED',
    title: 'Authentication Secret Demanded',
    citizenMessage: 'Demanding security credentials or authentication secrets is strictly prohibited.',
    technicalMessage: 'RequestedDataCategory is AUTHENTICATION_SECRET.',
    severity: 'CRITICAL'
  },
  POLICY_CONSTRAINTS_VIOLATED: {
    code: 'POLICY_CONSTRAINTS_VIOLATED',
    title: 'Policy Constraints Violated',
    citizenMessage: 'The request does not satisfy specific conditions and constraints required by the policy.',
    technicalMessage: 'One or more declarative constraints in policy.constraints evaluated to false.',
    severity: 'HIGH'
  }
};

export function getReasonDefinition(code: string): ReasonDefinition {
  return REASON_CATALOG[code] || {
    code,
    title: 'Unknown Rule Reason',
    citizenMessage: 'An evaluation rule triggered with code: ' + code,
    technicalMessage: 'Unregistered reason code triggered during evaluation: ' + code,
    severity: 'MEDIUM'
  };
}

export function getAllReasons(): ReasonDefinition[] {
  return Object.values(REASON_CATALOG);
}
