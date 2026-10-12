/**
 * TRUSTGOV - PHASE 9: REPORT CONTROLLERS
 * Express request handlers for Citizen, Admin, and Public reporting endpoints.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { reportService } from '../services/reportService';
import { getAllReportCategories } from '../services/reportCategories';
import { EvidenceType } from '../types/reports';

// ---------------------------------------------------------------------
// CITIZEN CONTROLLERS
// ---------------------------------------------------------------------

/**
 * POST /api/citizen/reports
 * Submit a suspicious interaction report.
 */
export async function citizenCreateReport(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    const report = await reportService.createReport(req.body, citizenId);

    return res.status(201).json({
      success: true,
      data: { report }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to submit report' }
    });
  }
}

/**
 * GET /api/citizen/reports
 * List reports filed by the authenticated citizen.
 */
export async function citizenListReports(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    const reports = await reportService.listCitizenReports(citizenId);

    return res.status(200).json({
      success: true,
      data: { reports, total: reports.length }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to list citizen reports' }
    });
  }
}

/**
 * GET /api/citizen/reports/:reportId
 * View report details and attached evidence. Strict privacy isolation.
 */
export async function citizenGetReportById(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    const result = await reportService.getCitizenReportById(req.params.reportId, citizenId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to retrieve report' }
    });
  }
}

/**
 * POST /api/citizen/reports/:reportId/evidence
 * Upload and attach evidence. Supports multipart/form-data or base64 JSON payload.
 */
export async function citizenAddEvidence(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    let buffer: Buffer;
    let originalFilename: string;
    let mimeType: string;
    let evidenceType: EvidenceType = (req.body.evidenceType as EvidenceType) || 'OTHER';
    let description: string | undefined = req.body.description;

    // Check if multipart file exists on request (e.g. from multer)
    const file = (req as any).file;
    if (file) {
      buffer = file.buffer || (file.path ? require('fs').readFileSync(file.path) : Buffer.from(''));
      originalFilename = file.originalname;
      mimeType = file.mimetype;
    } else if (req.body.contentBase64) {
      // JSON base64 upload
      buffer = Buffer.from(req.body.contentBase64, 'base64');
      originalFilename = req.body.originalFilename || 'evidence.png';
      mimeType = req.body.mimeType || 'image/png';
    } else if (req.body.content) {
      // Plain text content
      buffer = Buffer.from(req.body.content, 'utf-8');
      originalFilename = req.body.originalFilename || 'evidence.txt';
      mimeType = req.body.mimeType || 'text/plain';
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_EVIDENCE_FILE', message: 'Evidence file payload is required.' }
      });
    }

    const evidence = await reportService.addEvidence(
      req.params.reportId,
      {
        evidenceType,
        description,
        originalFilename,
        mimeType,
        buffer
      },
      citizenId
    );

    return res.status(201).json({
      success: true,
      data: { evidence }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to attach evidence' }
    });
  }
}

/**
 * GET /api/citizen/reports/:reportId/evidence/:evidenceId/integrity
 * Verify SHA-256 integrity of attached evidence.
 */
export async function citizenCheckEvidenceIntegrity(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    const result = await reportService.checkEvidenceIntegrity(
      req.params.reportId,
      req.params.evidenceId,
      citizenId,
      false
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to verify evidence integrity' }
    });
  }
}

/**
 * GET /api/citizen/reports/:reportId/evidence/:evidenceId/file
 * Download/preview evidence file safely.
 */
export async function citizenGetEvidenceFile(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Citizen authentication required.' }
      });
    }

    const file = await reportService.getEvidenceFile(
      req.params.reportId,
      req.params.evidenceId,
      citizenId,
      false
    );

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalFilename}"`);
    return res.send(file.buffer);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to fetch evidence file' }
    });
  }
}

// ---------------------------------------------------------------------
// ADMIN CONTROLLERS
// ---------------------------------------------------------------------

/**
 * GET /api/admin/reports
 * List reports with optional status, category, risk, and search filters.
 */
export async function adminListReports(req: Request, res: Response) {
  try {
    const { status, category, riskLevel, search } = req.query;
    const reports = await reportService.listAdminReports({
      status: status ? String(status) : undefined,
      category: category ? String(category) : undefined,
      riskLevel: riskLevel ? String(riskLevel) : undefined,
      search: search ? String(search) : undefined
    });

    return res.status(200).json({
      success: true,
      data: { reports, total: reports.length }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to list reports' }
    });
  }
}

/**
 * GET /api/admin/reports/:reportId
 * View report details, evidence, and internal review notes.
 */
export async function adminGetReportById(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'admin';
    const result = await reportService.getAdminReportById(req.params.reportId, adminUserId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to retrieve report' }
    });
  }
}

/**
 * PATCH /api/admin/reports/:reportId/status
 * Transition report status according to allowed lifecycle rules.
 */
export async function adminUpdateReportStatus(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'admin';
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'STATUS_REQUIRED', message: 'Field status is required.' }
      });
    }

    const report = await reportService.updateReportStatus(req.params.reportId, status, adminUserId);

    return res.status(200).json({
      success: true,
      data: { report }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || 'STATUS_UPDATE_FAILED', message: err.message || 'Failed to update status' }
    });
  }
}

/**
 * POST /api/admin/reports/:reportId/notes
 * Add internal review note. Admin only.
 */
export async function adminAddReviewNote(req: Request, res: Response) {
  try {
    const adminUser = (req as AuthenticatedRequest).user;
    const adminUserId = adminUser?.id || 'admin';
    const adminName = (adminUser as any)?.name || adminUser?.email || 'Admin Reviewer';
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOTE_REQUIRED', message: 'Note content is required.' }
      });
    }

    const reviewNote = await reportService.addReviewNote(
      req.params.reportId,
      note,
      adminUserId,
      adminName
    );

    return res.status(201).json({
      success: true,
      data: { note: reviewNote }
    });
  } catch (err: any) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to add review note' }
    });
  }
}

/**
 * GET /api/admin/reports/:reportId/evidence/:evidenceId/integrity
 * Admin evidence integrity verification.
 */
export async function adminCheckEvidenceIntegrity(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'admin';
    const result = await reportService.checkEvidenceIntegrity(
      req.params.reportId,
      req.params.evidenceId,
      adminUserId,
      true
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to verify evidence integrity' }
    });
  }
}

// ---------------------------------------------------------------------
// PUBLIC CONTROLLERS
// ---------------------------------------------------------------------

/**
 * GET /api/reports/public/:reportId
 * Safe, sanitized public report reference. Exposes ZERO citizen PII.
 */
export async function publicGetReportReference(req: Request, res: Response) {
  try {
    const result = await reportService.getPublicReportReference(req.params.reportId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to retrieve public reference' }
    });
  }
}

/**
 * GET /api/reports/categories
 * List all centralized report categories.
 */
export async function publicListCategories(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: { categories: getAllReportCategories() }
  });
}
