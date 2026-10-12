/**
 * TRUSTGOV - PHASE 9: SCAM REPORTING & EVIDENCE SERVICE
 * 
 * Implements:
 * - Server-side report creation and ID generation (TG-REPORT-XXXXXXXX)
 * - Strict tenant isolation (Citizen A cannot read Citizen B reports)
 * - Safe linking to Phase 7 verifications and Phase 8 evaluations
 * - Server-side evidence attachment with SHA-256 calculation
 * - Live cryptographic evidence integrity verification
 * - Status transition lifecycle engine
 * - Admin-only internal review notes
 * - Sanitized public reference lookups (zero citizen PII)
 * - Audit event generation
 */

import crypto from 'crypto';
import { pool } from '../config/db';
import {
  CreateReportInput,
  EvidenceUploadInput,
  EvidenceIntegrityResult,
  PublicReportReference,
  ReportStatus,
  ScamReport,
  ReportEvidence,
  ReportReviewNote
} from '../types/reports';
import { isValidReportCategory, getReportCategory } from './reportCategories';
import { storeEvidenceBuffer, verifyEvidenceIntegrity, readEvidenceBuffer } from './reportStorage';
import { logAudit } from './audit';

/**
 * Generate a cryptographically secure, non-sequential reference code
 * Format: PREFIX-XXXXXXXX (8 uppercase alphanumeric characters, excluding ambiguous 0, 1, I, O)
 */
export function generateReference(prefix: 'TG-REPORT' | 'TG-EVIDENCE' | 'TG-NOTE'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let ref = `${prefix}-`;
  for (let i = 0; i < 8; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

/**
 * Allowed status transitions for reports.
 * Citizens cannot change report status; only authorized Admins can perform these.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['ADDITIONAL_INFORMATION_REQUIRED', 'RESOLVED', 'CLOSED'],
  ADDITIONAL_INFORMATION_REQUIRED: ['UNDER_REVIEW'],
  RESOLVED: ['CLOSED'],
  CLOSED: []
};

/**
 * Simple HTML/Script tag sanitizer for text descriptions.
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export class ReportService {
  /**
   * Create a new suspicious interaction report.
   * Server-authoritative: status is always 'SUBMITTED', ID is generated server-side.
   */
  async createReport(input: CreateReportInput, citizenId: string): Promise<ScamReport> {
    if (!citizenId) {
      throw {
        statusCode: 401,
        code: 'UNAUTHORIZED',
        message: 'Authentication required to submit an interaction report.'
      };
    }

    // 1. Validate Category
    if (!input.reportCategory || !isValidReportCategory(input.reportCategory)) {
      throw {
        statusCode: 400,
        code: 'INVALID_REPORT_CATEGORY',
        message: `Report category '${input.reportCategory}' is not recognized in the TrustGov catalog.`
      };
    }

    // 2. Validate Description
    const rawDescription = (input.description || '').trim();
    if (rawDescription.length < 10 || rawDescription.length > 5000) {
      throw {
        statusCode: 400,
        code: 'INVALID_DESCRIPTION_LENGTH',
        message: `Report description must be between 10 and 5000 characters (${rawDescription.length} characters provided).`
      };
    }
    const sanitizedDescription = sanitizeText(rawDescription);

    // 3. Resolve Officer Reference (if supplied)
    let officerName: string | null = null;
    let department: string | null = null;
    const officerRef = (input.officerReference || '').trim();

    if (officerRef) {
      const offQuery = 'SELECT full_name, department FROM officers WHERE officer_code = $1 OR id = $1 LIMIT 1';
      const offRes = await pool.query(offQuery, [officerRef]);
      if (offRes.rows.length > 0) {
        officerName = offRes.rows[0].full_name;
        department = offRes.rows[0].department;
      }
    }

    // 4. Validate Linked Verification (if supplied)
    const verificationRef = (input.verificationReference || '').trim();
    if (verificationRef) {
      const vfyQuery = 'SELECT * FROM citizen_verification_history WHERE verification_id = $1 LIMIT 1';
      const vfyRes = await pool.query(vfyQuery, [verificationRef]);
      if (vfyRes.rows.length === 0) {
        throw {
          statusCode: 400,
          code: 'INVALID_VERIFICATION_REFERENCE',
          message: `Verification reference '${verificationRef}' does not correspond to an official TrustGov verification record.`
        };
      }
    }

    // 5. Validate Linked Authorization Evaluation (if supplied)
    let inheritedRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN' = 'UNKNOWN';
    let inheritedActionCode: string | null = input.reportedActionCode || null;
    const authRef = (input.authorizationEvaluationReference || '').trim();

    if (authRef) {
      const authQuery = 'SELECT * FROM authorization_evaluations WHERE evaluation_id = $1 LIMIT 1';
      const authRes = await pool.query(authQuery, [authRef]);
      if (authRes.rows.length === 0) {
        throw {
          statusCode: 400,
          code: 'INVALID_AUTHORIZATION_REFERENCE',
          message: `Authorization evaluation reference '${authRef}' does not correspond to a valid TrustGov evaluation.`
        };
      }

      const evalRow = authRes.rows[0];
      // Privacy check: Citizen cannot link another citizen's private evaluation
      if (evalRow.citizen_id && evalRow.citizen_id !== citizenId) {
        throw {
          statusCode: 400,
          code: 'UNAUTHORIZED_EVALUATION_LINK',
          message: 'Cannot link an evaluation record performed by another citizen account.'
        };
      }

      inheritedRiskLevel = evalRow.risk_level || 'UNKNOWN';
      if (!inheritedActionCode && evalRow.action_code) {
        inheritedActionCode = evalRow.action_code;
      }
      if (!officerName && evalRow.officer_name) {
        officerName = evalRow.officer_name;
      }
      if (!department && evalRow.department) {
        department = evalRow.department;
      }
    }

    // Default risk level based on report category severity guidance if still unknown
    if (inheritedRiskLevel === 'UNKNOWN') {
      const categoryDef = getReportCategory(input.reportCategory);
      if (categoryDef?.severityGuidance === 'CRITICAL') {
        inheritedRiskLevel = 'CRITICAL';
      } else if (categoryDef?.severityGuidance === 'HIGH') {
        inheritedRiskLevel = 'HIGH';
      }
    }

    // 6. Generate IDs and Persist
    const id = crypto.randomUUID();
    const reportId = generateReference('TG-REPORT');
    const now = new Date();

    const insertQuery = `
      INSERT INTO scam_reports (
        id, report_id, citizen_id, officer_reference, officer_name, department,
        verification_reference, authorization_evaluation_reference, report_category,
        description, reported_action_code, risk_level, status, submitted_at, updated_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SUBMITTED', $13, $13, $13)
      RETURNING *
    `;

    const res = await pool.query(insertQuery, [
      id,
      reportId,
      citizenId,
      officerRef || null,
      officerName,
      department,
      verificationRef || null,
      authRef || null,
      input.reportCategory,
      sanitizedDescription,
      inheritedActionCode,
      inheritedRiskLevel,
      now
    ]);

    const created = res.rows[0];

    // 7. Audit log event
    await logAudit({
      actorId: citizenId,
      action: 'REPORT_CREATED',
      entityType: 'SCAM_REPORT',
      entityId: reportId,
      metadata: {
        reportId,
        category: input.reportCategory,
        officerReference: officerRef || null,
        riskLevel: inheritedRiskLevel
      }
    });

    return {
      id: created.id,
      reportId: created.report_id,
      citizenId: created.citizen_id,
      officerReference: created.officer_reference,
      officerName: created.officer_name,
      department: created.department,
      verificationReference: created.verification_reference,
      authorizationEvaluationReference: created.authorization_evaluation_reference,
      reportCategory: created.report_category,
      description: created.description,
      reportedActionCode: created.reported_action_code,
      riskLevel: created.risk_level,
      status: created.status,
      submittedAt: created.submitted_at,
      updatedAt: created.updated_at,
      resolvedAt: created.resolved_at,
      createdAt: created.created_at
    };
  }

  /**
   * Retrieve report by ID for citizen owner.
   * Strict privacy: if not found or belongs to another citizen, returns 404 RECORD_NOT_FOUND.
   */
  async getCitizenReportById(reportIdOrId: string, citizenId: string): Promise<{
    report: ScamReport;
    evidence: ReportEvidence[];
  }> {
    const query = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const res = await pool.query(query, [reportIdOrId]);

    if (res.rows.length === 0 || res.rows[0].citizen_id !== citizenId) {
      throw {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'No report record found for this identifier.'
      };
    }

    const row = res.rows[0];
    const report: ScamReport = {
      id: row.id,
      reportId: row.report_id,
      citizenId: row.citizen_id,
      officerReference: row.officer_reference,
      officerName: row.officer_name,
      department: row.department,
      verificationReference: row.verification_reference,
      authorizationEvaluationReference: row.authorization_evaluation_reference,
      reportCategory: row.report_category,
      description: row.description,
      reportedActionCode: row.reported_action_code,
      riskLevel: row.risk_level,
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };

    // Fetch attached evidence
    const evQuery = 'SELECT * FROM report_evidence WHERE report_id = $1 ORDER BY created_at ASC';
    const evRes = await pool.query(evQuery, [row.id]);

    const evidence: ReportEvidence[] = evRes.rows.map((e: any) => ({
      id: e.id,
      evidenceId: e.evidence_id,
      reportId: e.report_id,
      evidenceType: e.evidence_type,
      originalFilename: e.original_filename,
      storedFilename: e.stored_filename,
      mimeType: e.mime_type,
      fileSize: e.file_size,
      sha256Hash: e.sha256_hash,
      storageReference: e.storage_reference,
      description: e.description,
      uploadedBy: e.uploaded_by,
      uploadedAt: e.uploaded_at,
      createdAt: e.created_at
    }));

    await logAudit({
      actorId: citizenId,
      action: 'REPORT_VIEWED',
      entityType: 'SCAM_REPORT',
      entityId: report.reportId,
      metadata: { reportId: report.reportId }
    });

    return { report, evidence };
  }

  /**
   * List reports for logged-in citizen.
   */
  async listCitizenReports(citizenId: string): Promise<ScamReport[]> {
    const query = 'SELECT * FROM scam_reports WHERE citizen_id = $1 ORDER BY submitted_at DESC';
    const res = await pool.query(query, [citizenId]);

    return res.rows.map((row: any) => ({
      id: row.id,
      reportId: row.report_id,
      citizenId: row.citizen_id,
      officerReference: row.officer_reference,
      officerName: row.officer_name,
      department: row.department,
      verificationReference: row.verification_reference,
      authorizationEvaluationReference: row.authorization_evaluation_reference,
      reportCategory: row.report_category,
      description: row.description,
      reportedActionCode: row.reported_action_code,
      riskLevel: row.risk_level,
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    }));
  }

  /**
   * Upload and attach an evidence file to a report.
   */
  async addEvidence(
    reportIdOrId: string,
    input: EvidenceUploadInput,
    citizenId: string
  ): Promise<ReportEvidence> {
    // 1. Verify report ownership
    const reportQuery = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0 || repRes.rows[0].citizen_id !== citizenId) {
      throw {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'No report record found matching this identifier.'
      };
    }
    const report = repRes.rows[0];

    // 2. Check maximum files limit (max 10)
    const countQuery = 'SELECT COUNT(*) as count FROM report_evidence WHERE report_id = $1';
    const countRes = await pool.query(countQuery, [report.id]);
    const currentCount = parseInt(countRes.rows[0].count, 10) || 0;

    if (currentCount >= 10) {
      throw {
        statusCode: 400,
        code: 'MAX_EVIDENCE_EXCEEDED',
        message: 'A maximum of 10 evidence files may be attached per report.'
      };
    }

    // 3. Store file and calculate SHA-256 server-side
    const storageResult = await storeEvidenceBuffer(
      input.originalFilename,
      input.mimeType,
      input.buffer
    );

    // 4. Persist evidence record
    const id = crypto.randomUUID();
    const evidenceId = generateReference('TG-EVIDENCE');
    const now = new Date();

    const insertEvQuery = `
      INSERT INTO report_evidence (
        id, evidence_id, report_id, evidence_type, original_filename, stored_filename,
        mime_type, file_size, sha256_hash, storage_reference, description,
        uploaded_by, uploaded_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
      RETURNING *
    `;

    const evRes = await pool.query(insertEvQuery, [
      id,
      evidenceId,
      report.id,
      input.evidenceType || 'OTHER',
      input.originalFilename,
      storageResult.storedFilename,
      input.mimeType,
      storageResult.fileSize,
      storageResult.sha256Hash,
      storageResult.storageReference,
      input.description || null,
      citizenId,
      now
    ]);

    const createdEv = evRes.rows[0];

    // 5. Audit log event
    await logAudit({
      actorId: citizenId,
      action: 'REPORT_EVIDENCE_ADDED',
      entityType: 'REPORT_EVIDENCE',
      entityId: evidenceId,
      metadata: {
        evidenceId,
        reportId: report.report_id,
        sha256Hash: storageResult.sha256Hash,
        fileSize: storageResult.fileSize,
        mimeType: input.mimeType
      }
    });

    return {
      id: createdEv.id,
      evidenceId: createdEv.evidence_id,
      reportId: createdEv.report_id,
      evidenceType: createdEv.evidence_type,
      originalFilename: createdEv.original_filename,
      storedFilename: createdEv.stored_filename,
      mimeType: createdEv.mime_type,
      fileSize: createdEv.file_size,
      sha256Hash: createdEv.sha256_hash,
      storageReference: createdEv.storage_reference,
      description: createdEv.description,
      uploadedBy: createdEv.uploaded_by,
      uploadedAt: createdEv.uploaded_at,
      createdAt: createdEv.created_at
    };
  }

  /**
   * Live SHA-256 Evidence Integrity Verification.
   * Compares the SHA-256 hash of the currently stored file bytes against the recorded hash.
   */
  async checkEvidenceIntegrity(
    reportIdOrId: string,
    evidenceIdOrId: string,
    requestingUserId: string,
    isAdmin: boolean
  ): Promise<EvidenceIntegrityResult> {
    // 1. Verify access to report
    const reportQuery = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'No report record found matching this identifier.'
      };
    }
    const report = repRes.rows[0];

    // If not admin, requester must be the citizen owner
    if (!isAdmin && report.citizen_id !== requestingUserId) {
      throw {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'No report record found matching this identifier.'
      };
    }

    // 2. Fetch evidence metadata
    const evQuery = `
      SELECT * FROM report_evidence
      WHERE (id = $1 OR evidence_id = $1) AND report_id = $2
      LIMIT 1
    `;
    const evRes = await pool.query(evQuery, [evidenceIdOrId, report.id]);

    if (evRes.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'EVIDENCE_NOT_FOUND',
        message: 'No evidence record found matching this identifier.'
      };
    }
    const evidence = evRes.rows[0];

    // 3. Recalculate hash from stored bytes
    const verification = await verifyEvidenceIntegrity(
      evidence.stored_filename,
      evidence.sha256_hash
    );

    // 4. Audit log event
    await logAudit({
      actorId: requestingUserId,
      action: 'REPORT_EVIDENCE_INTEGRITY_CHECKED',
      entityType: 'REPORT_EVIDENCE',
      entityId: evidence.evidence_id,
      metadata: {
        evidenceId: evidence.evidence_id,
        reportId: report.report_id,
        integrityResult: verification.valid ? 'VALID' : 'INTEGRITY_MISMATCH'
      }
    });

    return {
      evidenceId: evidence.evidence_id,
      integrity: verification.valid ? 'VALID' : 'INTEGRITY_MISMATCH',
      algorithm: 'SHA-256',
      storedHash: evidence.sha256_hash,
      calculatedHash: verification.calculatedHash,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Retrieve evidence raw buffer for download or preview.
   */
  async getEvidenceFile(
    reportIdOrId: string,
    evidenceIdOrId: string,
    requestingUserId: string,
    isAdmin: boolean
  ): Promise<{ buffer: Buffer; mimeType: string; originalFilename: string }> {
    const reportQuery = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0) {
      throw { statusCode: 404, code: 'RECORD_NOT_FOUND', message: 'Report not found' };
    }
    const report = repRes.rows[0];

    if (!isAdmin && report.citizen_id !== requestingUserId) {
      throw { statusCode: 404, code: 'RECORD_NOT_FOUND', message: 'Report not found' };
    }

    const evQuery = 'SELECT * FROM report_evidence WHERE (id = $1 OR evidence_id = $1) AND report_id = $2 LIMIT 1';
    const evRes = await pool.query(evQuery, [evidenceIdOrId, report.id]);

    if (evRes.rows.length === 0) {
      throw { statusCode: 404, code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found' };
    }
    const evidence = evRes.rows[0];

    const buffer = await readEvidenceBuffer(evidence.stored_filename);
    if (!buffer) {
      throw { statusCode: 404, code: 'FILE_NOT_FOUND', message: 'Evidence file content could not be located' };
    }

    await logAudit({
      actorId: requestingUserId,
      action: 'REPORT_EVIDENCE_ACCESSED',
      entityType: 'REPORT_EVIDENCE',
      entityId: evidence.evidence_id,
      metadata: { evidenceId: evidence.evidence_id }
    });

    return {
      buffer,
      mimeType: evidence.mime_type,
      originalFilename: evidence.original_filename
    };
  }

  /**
   * Admin: List reports with filtering and search.
   */
  async listAdminReports(filters: {
    status?: string;
    category?: string;
    riskLevel?: string;
    search?: string;
  } = {}): Promise<ScamReport[]> {
    let query = 'SELECT * FROM scam_reports WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.category) {
      query += ` AND report_category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters.riskLevel) {
      query += ` AND risk_level = $${paramIndex++}`;
      params.push(filters.riskLevel);
    }

    if (filters.search) {
      query += ` AND (report_id ILIKE $${paramIndex} OR officer_reference ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    query += ' ORDER BY submitted_at DESC';

    const res = await pool.query(query, params);

    return res.rows.map((row: any) => ({
      id: row.id,
      reportId: row.report_id,
      citizenId: row.citizen_id,
      officerReference: row.officer_reference,
      officerName: row.officer_name,
      department: row.department,
      verificationReference: row.verification_reference,
      authorizationEvaluationReference: row.authorization_evaluation_reference,
      reportCategory: row.report_category,
      description: row.description,
      reportedActionCode: row.reported_action_code,
      riskLevel: row.risk_level,
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    }));
  }

  /**
   * Admin: Get full report details including attached evidence and internal review notes.
   */
  async getAdminReportById(reportIdOrId: string, adminUserId: string): Promise<{
    report: ScamReport;
    evidence: ReportEvidence[];
    reviewNotes: ReportReviewNote[];
  }> {
    const reportQuery = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'REPORT_NOT_FOUND',
        message: 'No report found matching this identifier.'
      };
    }
    const row = repRes.rows[0];

    const report: ScamReport = {
      id: row.id,
      reportId: row.report_id,
      citizenId: row.citizen_id,
      officerReference: row.officer_reference,
      officerName: row.officer_name,
      department: row.department,
      verificationReference: row.verification_reference,
      authorizationEvaluationReference: row.authorization_evaluation_reference,
      reportCategory: row.report_category,
      description: row.description,
      reportedActionCode: row.reported_action_code,
      riskLevel: row.risk_level,
      status: row.status,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at
    };

    // Fetch evidence
    const evQuery = 'SELECT * FROM report_evidence WHERE report_id = $1 ORDER BY created_at ASC';
    const evRes = await pool.query(evQuery, [row.id]);
    const evidence: ReportEvidence[] = evRes.rows.map((e: any) => ({
      id: e.id,
      evidenceId: e.evidence_id,
      reportId: e.report_id,
      evidenceType: e.evidence_type,
      originalFilename: e.original_filename,
      storedFilename: e.stored_filename,
      mimeType: e.mime_type,
      fileSize: e.file_size,
      sha256Hash: e.sha256_hash,
      storageReference: e.storage_reference,
      description: e.description,
      uploadedBy: e.uploaded_by,
      uploadedAt: e.uploaded_at,
      createdAt: e.created_at
    }));

    // Fetch internal review notes (admin only)
    const notesQuery = 'SELECT * FROM report_review_notes WHERE report_id = $1 ORDER BY created_at ASC';
    const notesRes = await pool.query(notesQuery, [row.id]);
    const reviewNotes: ReportReviewNote[] = notesRes.rows.map((n: any) => ({
      id: n.id,
      reportId: n.report_id,
      noteId: n.note_id,
      reviewerId: n.reviewer_id,
      reviewerName: n.reviewer_name,
      note: n.note,
      createdAt: n.created_at
    }));

    await logAudit({
      actorId: adminUserId,
      action: 'REPORT_VIEWED',
      entityType: 'SCAM_REPORT',
      entityId: report.reportId,
      metadata: { reportId: report.reportId, role: 'ADMIN' }
    });

    return { report, evidence, reviewNotes };
  }

  /**
   * Admin: Transition report status. Enforces centralized status transition matrix.
   */
  async updateReportStatus(
    reportIdOrId: string,
    newStatus: ReportStatus,
    adminUserId: string
  ): Promise<ScamReport> {
    const reportQuery = 'SELECT * FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'REPORT_NOT_FOUND',
        message: 'No report found matching this identifier.'
      };
    }
    const current = repRes.rows[0];
    const currentStatus = current.status as ReportStatus;

    // Validate transition
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
      throw {
        statusCode: 400,
        code: 'INVALID_STATUS_TRANSITION',
        message: `Status transition from '${currentStatus}' to '${newStatus}' is not permitted. Allowed transitions: ${allowedNext.join(', ') || 'None (Terminal state)'}.`
      };
    }

    const now = new Date();
    const resolvedAt = newStatus === 'RESOLVED' ? now : current.resolved_at;

    const updateQuery = `
      UPDATE scam_reports
      SET status = $1, updated_at = $2, resolved_at = $3
      WHERE id = $4
      RETURNING *
    `;
    const updateRes = await pool.query(updateQuery, [newStatus, now, resolvedAt, current.id]);
    const updated = updateRes.rows[0];

    // Audit logs
    await logAudit({
      actorId: adminUserId,
      action: 'REPORT_STATUS_CHANGED',
      entityType: 'SCAM_REPORT',
      entityId: current.report_id,
      metadata: {
        reportId: current.report_id,
        oldStatus: currentStatus,
        newStatus
      }
    });

    if (newStatus === 'RESOLVED') {
      await logAudit({
        actorId: adminUserId,
        action: 'REPORT_RESOLVED',
        entityType: 'SCAM_REPORT',
        entityId: current.report_id,
        metadata: { reportId: current.report_id }
      });
    } else if (newStatus === 'CLOSED') {
      await logAudit({
        actorId: adminUserId,
        action: 'REPORT_CLOSED',
        entityType: 'SCAM_REPORT',
        entityId: current.report_id,
        metadata: { reportId: current.report_id }
      });
    }

    return {
      id: updated.id,
      reportId: updated.report_id,
      citizenId: updated.citizen_id,
      officerReference: updated.officer_reference,
      officerName: updated.officer_name,
      department: updated.department,
      verificationReference: updated.verification_reference,
      authorizationEvaluationReference: updated.authorization_evaluation_reference,
      reportCategory: updated.report_category,
      description: updated.description,
      reportedActionCode: updated.reported_action_code,
      riskLevel: updated.risk_level,
      status: updated.status,
      submittedAt: updated.submitted_at,
      updatedAt: updated.updated_at,
      resolvedAt: updated.resolved_at,
      createdAt: updated.created_at
    };
  }

  /**
   * Admin: Add an internal review note to a report.
   */
  async addReviewNote(
    reportIdOrId: string,
    noteText: string,
    adminUserId: string,
    adminName?: string
  ): Promise<ReportReviewNote> {
    const rawNote = (noteText || '').trim();
    if (rawNote.length < 2) {
      throw {
        statusCode: 400,
        code: 'INVALID_NOTE',
        message: 'Review note text must contain at least 2 characters.'
      };
    }

    const reportQuery = 'SELECT id, report_id FROM scam_reports WHERE id = $1 OR report_id = $1 LIMIT 1';
    const repRes = await pool.query(reportQuery, [reportIdOrId]);

    if (repRes.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'REPORT_NOT_FOUND',
        message: 'No report found matching this identifier.'
      };
    }
    const report = repRes.rows[0];

    const id = crypto.randomUUID();
    const noteId = generateReference('TG-NOTE');
    const now = new Date();

    const insertQuery = `
      INSERT INTO report_review_notes (id, report_id, note_id, reviewer_id, reviewer_name, note, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const res = await pool.query(insertQuery, [
      id,
      report.id,
      noteId,
      adminUserId,
      adminName || 'Admin Reviewer',
      rawNote,
      now
    ]);

    const created = res.rows[0];

    await logAudit({
      actorId: adminUserId,
      action: 'REPORT_REVIEW_NOTE_ADDED',
      entityType: 'REPORT_REVIEW_NOTE',
      entityId: noteId,
      metadata: { reportId: report.report_id, noteId }
    });

    return {
      id: created.id,
      reportId: created.report_id,
      noteId: created.note_id,
      reviewerId: created.reviewer_id,
      reviewerName: created.reviewer_name,
      note: created.note,
      createdAt: created.created_at
    };
  }

  /**
   * Public: Sanitized report lookup.
   * Strictly returns ZERO citizen identity, zero PII, zero evidence files, and zero review notes.
   */
  async getPublicReportReference(reportId: string): Promise<PublicReportReference> {
    const query = 'SELECT * FROM scam_reports WHERE report_id = $1 LIMIT 1';
    const res = await pool.query(query, [reportId]);

    if (res.rows.length === 0) {
      throw {
        statusCode: 404,
        code: 'RECORD_NOT_FOUND',
        message: 'No report record found matching this reference.'
      };
    }

    const row = res.rows[0];
    const categoryDef = getReportCategory(row.report_category);

    return {
      reportId: row.report_id,
      category: row.report_category,
      categoryDisplayName: categoryDef?.displayName || row.report_category,
      status: row.status,
      submittedAt: new Date(row.submitted_at).toISOString(),
      linkedVerification: row.verification_reference || null,
      linkedAuthorization: row.authorization_evaluation_reference || null,
      disclaimer: 'This public reference does not constitute confirmation that the reported incident has been independently verified. TrustGov Demo Reporting System.'
    };
  }
}

export const reportService = new ReportService();
