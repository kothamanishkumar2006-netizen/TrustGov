/**
 * TRUSTGOV - PHASE 9: CENTRALIZED REPORT CATEGORY CATALOG
 * Defines standardized categories for citizen-submitted suspicious interaction reports.
 * 
 * IMPORTANT:
 * These are reporting categories to structure citizen feedback.
 * They do NOT establish that fraud, impersonation, or criminal conduct actually occurred.
 */

import { ReportCategoryCode, ReportCategoryDefinition } from '../types/reports';

export const REPORT_CATEGORIES: Record<ReportCategoryCode, ReportCategoryDefinition> = {
  IMPERSONATION: {
    categoryCode: 'IMPERSONATION',
    displayName: 'Impersonation of Government Official',
    description: 'Caller, visitor, or sender claimed to be an official police officer, CBI, ED, or court authority without genuine credentials.',
    severityGuidance: 'HIGH'
  },
  PAYMENT_DEMAND: {
    categoryCode: 'PAYMENT_DEMAND',
    displayName: 'Demand for Personal Payment / Transfer',
    description: 'Demand for money transfer to a personal UPI ID, personal bank account, or cash payment under pretext of bail, penalty, or clearance.',
    severityGuidance: 'CRITICAL'
  },
  OTP_REQUEST: {
    categoryCode: 'OTP_REQUEST',
    displayName: 'Request for One-Time Password (OTP)',
    description: 'Demand to disclose an SMS, mobile, or email OTP under pressure or official guise.',
    severityGuidance: 'CRITICAL'
  },
  PIN_REQUEST: {
    categoryCode: 'PIN_REQUEST',
    displayName: 'Request for ATM / UPI / Security PIN',
    description: 'Demand to reveal card numbers, ATM PIN, or UPI passcode.',
    severityGuidance: 'CRITICAL'
  },
  PASSWORD_REQUEST: {
    categoryCode: 'PASSWORD_REQUEST',
    displayName: 'Request for Account / Net-Banking Password',
    description: 'Demand to disclose internet banking, email, or government portal credentials.',
    severityGuidance: 'CRITICAL'
  },
  REMOTE_ACCESS_REQUEST: {
    categoryCode: 'REMOTE_ACCESS_REQUEST',
    displayName: 'Demand for Remote Screen Access',
    description: 'Instruction to download or install remote access software such as AnyDesk, TeamViewer, or RustDesk.',
    severityGuidance: 'CRITICAL'
  },
  THREAT_OR_COERCION: {
    categoryCode: 'THREAT_OR_COERCION',
    displayName: 'Threat of Arrest / Coercion / "Digital Arrest"',
    description: 'Threat of immediate physical or "digital arrest", detention, bank account freezing, or legal action unless immediate compliance is granted.',
    severityGuidance: 'CRITICAL'
  },
  SUSPICIOUS_DOCUMENT: {
    categoryCode: 'SUSPICIOUS_DOCUMENT',
    displayName: 'Suspicious / Forged Official Document or Notice',
    description: 'Presentation of an arrest warrant, court summons, or departmental letterhead that appears counterfeit or lacks official digital verification.',
    severityGuidance: 'MEDIUM'
  },
  SUSPICIOUS_COMMUNICATION: {
    categoryCode: 'SUSPICIOUS_COMMUNICATION',
    displayName: 'Suspicious Video Call / WhatsApp Message',
    description: 'Communication via WhatsApp, Telegram, or Skype featuring police uniforms, departmental emblems, or mock courtroom backgrounds.',
    severityGuidance: 'HIGH'
  },
  IDENTITY_MISMATCH: {
    categoryCode: 'IDENTITY_MISMATCH',
    displayName: 'Officer Credentials Do Not Match Record',
    description: 'Physical badge or claimed details conflict with TrustGov cryptographic verification records.',
    severityGuidance: 'HIGH'
  },
  UNAUTHORIZED_REQUEST: {
    categoryCode: 'UNAUTHORIZED_REQUEST',
    displayName: 'Unauthorized Demand Outside Official Duty',
    description: 'Officer identity appears genuine, but the specific request exceeds statutory authority or violates demo policy.',
    severityGuidance: 'MEDIUM'
  },
  OTHER: {
    categoryCode: 'OTHER',
    displayName: 'Other Suspicious Interaction',
    description: 'Any other suspicious behavior, demand, or circumstance not captured by standard categories.',
    severityGuidance: 'LOW'
  }
};

export function getAllReportCategories(): ReportCategoryDefinition[] {
  return Object.values(REPORT_CATEGORIES);
}

export function getReportCategory(code: string): ReportCategoryDefinition | null {
  return REPORT_CATEGORIES[code as ReportCategoryCode] || null;
}

export function isValidReportCategory(code: string): code is ReportCategoryCode {
  return code in REPORT_CATEGORIES;
}
