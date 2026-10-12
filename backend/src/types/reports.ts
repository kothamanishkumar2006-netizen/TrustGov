/**
-- ============================================================
-- TRUSTGOV - PHASE 9: SCAM REPORTING & EVIDENCE MANAGEMENT
-- Type Definitions & Interfaces
-- ============================================================
*/

export type ReportCategoryCode =
  | 'IMPERSONATION'
  | 'PAYMENT_DEMAND'
  | 'OTP_REQUEST'
  | 'PIN_REQUEST'
  | 'PASSWORD_REQUEST'
  | 'REMOTE_ACCESS_REQUEST'
  | 'THREAT_OR_COERCION'
  | 'SUSPICIOUS_DOCUMENT'
  | 'SUSPICIOUS_COMMUNICATION'
  | 'IDENTITY_MISMATCH'
  | 'UNAUTHORIZED_REQUEST'
  | 'OTHER';

export type ReportStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'RESOLVED'
  | 'CLOSED';

export type EvidenceType =
  | 'SCREENSHOT'
  | 'IMAGE'
  | 'DOCUMENT'
  | 'MESSAGE_EXPORT'
  | 'CALL_DETAIL'
  | 'OTHER';

export type SeverityGuidance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ReportCategoryDefinition {
  categoryCode: ReportCategoryCode;
  displayName: string;
  description: string;
  severityGuidance: SeverityGuidance;
}

export interface ScamReport {
  id: string;
  reportId: string; // e.g. TG-REPORT-XXXXXXXX
  citizenId: string;
  officerReference?: string | null;
  officerName?: string | null;
  department?: string | null;
  verificationReference?: string | null;
  authorizationEvaluationReference?: string | null;
  reportCategory: ReportCategoryCode;
  description: string;
  reportedActionCode?: string | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  status: ReportStatus;
  submittedAt: string | Date;
  updatedAt: string | Date;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
}

export interface ReportEvidence {
  id: string;
  evidenceId: string; // e.g. TG-EVIDENCE-XXXXXXXX
  reportId: string;
  evidenceType: EvidenceType;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  storageReference: string;
  description?: string | null;
  uploadedBy: string;
  uploadedAt: string | Date;
  createdAt: string | Date;
}

export interface ReportReviewNote {
  id: string;
  reportId: string;
  noteId: string; // e.g. TG-NOTE-XXXXXXXX
  reviewerId: string;
  reviewerName?: string | null;
  note: string;
  createdAt: string | Date;
}

export interface CreateReportInput {
  officerReference?: string;
  verificationReference?: string;
  authorizationEvaluationReference?: string;
  reportCategory: ReportCategoryCode;
  description: string;
  reportedActionCode?: string;
}

export interface EvidenceUploadInput {
  evidenceType: EvidenceType;
  description?: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface EvidenceIntegrityResult {
  evidenceId: string;
  integrity: 'VALID' | 'INTEGRITY_MISMATCH';
  algorithm: 'SHA-256';
  storedHash: string;
  calculatedHash: string;
  verifiedAt: string;
}

export interface PublicReportReference {
  reportId: string;
  category: ReportCategoryCode;
  categoryDisplayName: string;
  status: ReportStatus;
  submittedAt: string;
  linkedVerification?: string | null;
  linkedAuthorization?: string | null;
  disclaimer: string;
}
