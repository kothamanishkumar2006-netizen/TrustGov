/**
 * TRUSTGOV - PHASE 8: AUTHORIZATION & RISK ENGINE
 * Type Definitions & Enums
 */

export type AuthorizationDecision = 'ALLOW' | 'DENY' | 'REVIEW';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AuthorizationPolicyStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

export type ActionCategory =
  | 'IDENTITY'
  | 'DOCUMENTATION'
  | 'INFORMATION'
  | 'PAYMENT'
  | 'CREDENTIAL_REQUEST'
  | 'SYSTEM_ACCESS'
  | 'PROCEDURAL'
  | 'GENERAL';

export type SafetyClassification =
  | 'STANDARD'
  | 'CONTROLLED'
  | 'HIGH_RISK'
  | 'PROHIBITED'
  | 'REVIEW_REQUIRED';

export type ActionCode =
  | 'VERIFY_IDENTITY'
  | 'REQUEST_DOCUMENT'
  | 'REQUEST_PERSONAL_INFORMATION'
  | 'REQUEST_PAYMENT'
  | 'REQUEST_UPI_PAYMENT'
  | 'REQUEST_BANK_TRANSFER'
  | 'REQUEST_OTP'
  | 'REQUEST_PIN'
  | 'REQUEST_PASSWORD'
  | 'REQUEST_REMOTE_ACCESS'
  | 'REQUEST_SOFTWARE_INSTALLATION'
  | 'REQUEST_PHYSICAL_APPEARANCE'
  | 'ISSUE_OFFICIAL_NOTICE'
  | 'REQUEST_SIGNED_DOCUMENT'
  | 'OTHER';

export type PaymentType =
  | 'NONE'
  | 'GOVERNMENT_PORTAL'
  | 'OFFICIAL_ACCOUNT'
  | 'PERSONAL_UPI'
  | 'PERSONAL_BANK'
  | 'UNKNOWN';

export type UrgencyLevel =
  | 'NORMAL'
  | 'URGENT'
  | 'IMMEDIATE';

export type CommunicationChannel =
  | 'OFFICIAL_PORTAL'
  | 'OFFICIAL_OFFICE'
  | 'VERIFIED_PHONE'
  | 'PERSONAL_PHONE'
  | 'WHATSAPP'
  | 'UNKNOWN';

export type RequestedDataCategory =
  | 'NONE'
  | 'BASIC_IDENTITY'
  | 'PERSONAL_INFORMATION'
  | 'FINANCIAL_INFORMATION'
  | 'AUTHENTICATION_SECRET'
  | 'DOCUMENTS';

export type ReasonSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ActionDefinition {
  actionCode: ActionCode;
  displayName: string;
  description: string;
  category: ActionCategory;
  safetyClassification: SafetyClassification;
}

export interface ReasonDefinition {
  code: string;
  title: string;
  citizenMessage: string;
  technicalMessage: string;
  severity: ReasonSeverity;
}

export interface PolicyConstraints {
  allowedChannels?: CommunicationChannel[];
  allowedDataCategories?: RequestedDataCategory[];
  paymentAllowed?: boolean;
  allowedPaymentTypes?: PaymentType[];
  otpAllowed?: boolean;
  remoteAccessAllowed?: boolean;
  requiresOfficialNotice?: boolean;
  maxUrgency?: UrgencyLevel;
  [key: string]: any;
}

export interface AuthorizationPolicy {
  id: string;
  policyCode: string;
  version: number;
  department: string;
  role: string;
  actionCode: ActionCode;
  decision: AuthorizationDecision;
  constraints: PolicyConstraints;
  description: string;
  status: AuthorizationPolicyStatus;
  effectiveFrom: string | Date;
  effectiveTo?: string | Date | null;
  createdBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface EvaluationRequestContext {
  paymentType?: PaymentType;
  paymentDestinationType?: string;
  urgency?: UrgencyLevel;
  communicationChannel?: CommunicationChannel;
  requestedDataCategory?: RequestedDataCategory;
  additionalContext?: string;
  [key: string]: any;
}

export interface EvaluationInput {
  officerReference: string;
  credentialReference?: string;
  actionCode: ActionCode;
  requestContext?: EvaluationRequestContext;
  challengeId?: string;
  signature?: string;
}

export interface EvaluationResultReason {
  code: string;
  severity: ReasonSeverity;
  title: string;
  message: string;
  technical?: string;
}

export interface AuthorizationEvaluationResult {
  evaluationId: string;
  decision: AuthorizationDecision;
  authorized: boolean;
  riskLevel: RiskLevel;
  identityVerified: boolean;
  policyMatched: boolean;
  policyCode: string | null;
  policyVersion: number | null;
  actionCode: ActionCode;
  reasonCodes: string[];
  reasons: EvaluationResultReason[];
  checksSummary: {
    identity: { status: string; details?: string };
    officerStatus: { status: string; details?: string };
    credential: { status: string; details?: string };
    proofOfPossession?: { status: string; details?: string };
    blockchain?: { status: string; details?: string };
    policyConstraint?: { status: string; details?: string };
    safetyRules: { status: string; details?: string };
  };
  officer: {
    reference: string;
    fullName?: string;
    department?: string;
    designation?: string;
    jurisdiction?: string;
  };
  evaluatedAt: string;
  disclaimer: string;
}
