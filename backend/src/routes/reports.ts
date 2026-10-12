/**
 * TRUSTGOV - PHASE 9: SCAM REPORTING & EVIDENCE ROUTES
 * 
 * Mounts:
 * - Citizen reporting, evidence upload, and integrity checks
 * - Admin report management, status transitions, and review notes
 * - Public report reference lookup (zero PII) and category listing
 */

import { Router } from 'express';
import {
  citizenCreateReport,
  citizenListReports,
  citizenGetReportById,
  citizenAddEvidence,
  citizenCheckEvidenceIntegrity,
  citizenGetEvidenceFile,
  adminListReports,
  adminGetReportById,
  adminUpdateReportStatus,
  adminAddReviewNote,
  adminCheckEvidenceIntegrity,
  publicGetReportReference,
  publicListCategories
} from '../controllers/reportController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// =====================================================================
// PUBLIC ROUTES
// =====================================================================
router.get('/reports/categories', publicListCategories);
router.get('/reports/public/:reportId', publicGetReportReference);

// =====================================================================
// CITIZEN ROUTES (CITIZEN or ADMIN role)
// =====================================================================
router.post(
  '/citizen/reports',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenCreateReport
);

router.get(
  '/citizen/reports',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenListReports
);

router.get(
  '/citizen/reports/:reportId',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenGetReportById
);

router.post(
  '/citizen/reports/:reportId/evidence',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenAddEvidence
);

router.get(
  '/citizen/reports/:reportId/evidence/:evidenceId/integrity',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenCheckEvidenceIntegrity
);

router.get(
  '/citizen/reports/:reportId/evidence/:evidenceId/file',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenGetEvidenceFile
);

// =====================================================================
// ADMIN ROUTES (ADMIN role only)
// =====================================================================
router.get(
  '/admin/reports',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminListReports
);

router.get(
  '/admin/reports/:reportId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminGetReportById
);

router.patch(
  '/admin/reports/:reportId/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminUpdateReportStatus
);

router.post(
  '/admin/reports/:reportId/notes',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminAddReviewNote
);

router.get(
  '/admin/reports/:reportId/evidence/:evidenceId/integrity',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminCheckEvidenceIntegrity
);

export default router;
