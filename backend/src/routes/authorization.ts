/**
 * TRUSTGOV - PHASE 8: AUTHORIZATION ROUTES
 * 
 * Mounts:
 * - Admin authorization policy management
 * - Citizen action evaluation and history
 * - Officer scope viewer
 * - Public evaluation reference lookup
 */

import { Router } from 'express';
import {
  adminListPolicies,
  adminGetPolicyById,
  adminCreatePolicy,
  adminCreatePolicyVersion,
  adminUpdatePolicyStatus,
  adminListActions,
  adminListReasonCodes,
  citizenEvaluateAction,
  citizenGetEvaluations,
  citizenGetEvaluationById,
  officerGetScope,
  publicGetEvaluationReference
} from '../controllers/authorizationController';
import {
  authenticateToken,
  authorizeRoles,
  optionalAuthenticateToken
} from '../middleware/auth';

const router = Router();

// =====================================================================
// ADMIN ROUTES (ADMIN only)
// =====================================================================
router.get(
  '/admin/authorization-policies',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminListPolicies
);

router.get(
  '/admin/authorization-policies/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminGetPolicyById
);

router.post(
  '/admin/authorization-policies',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminCreatePolicy
);

router.post(
  '/admin/authorization-policies/:id/version',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminCreatePolicyVersion
);

router.put(
  '/admin/authorization-policies/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminCreatePolicyVersion
);

router.patch(
  '/admin/authorization-policies/:id/status',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminUpdatePolicyStatus
);

router.get(
  '/admin/authorization-actions',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminListActions
);

router.get(
  '/admin/authorization-reason-codes',
  authenticateToken,
  authorizeRoles('ADMIN'),
  adminListReasonCodes
);

// =====================================================================
// CITIZEN ROUTES
// =====================================================================
router.post(
  '/citizen/authorization/evaluate',
  optionalAuthenticateToken,
  citizenEvaluateAction
);

router.get(
  '/citizen/authorization/evaluations',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenGetEvaluations
);

router.get(
  '/citizen/authorization/evaluations/:id',
  authenticateToken,
  authorizeRoles('CITIZEN', 'ADMIN'),
  citizenGetEvaluationById
);

// =====================================================================
// OFFICER ROUTE
// =====================================================================
router.get(
  '/officer/authorization/scope',
  authenticateToken,
  authorizeRoles('OFFICER', 'ADMIN'),
  officerGetScope
);

// =====================================================================
// PUBLIC REFERENCE ROUTE
// =====================================================================
router.get(
  '/verification/public/authorization/:reference',
  publicGetEvaluationReference
);

export default router;
