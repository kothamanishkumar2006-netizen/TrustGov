/**
 * TRUSTGOV - PHASE 8: AUTHORIZATION CONTROLLER
 * 
 * Provides:
 * 1. Admin Policy Management APIs
 * 2. Citizen Action Evaluation APIs & History
 * 3. Officer Authorization Scope View
 * 4. Public Safe Evaluation Reference Lookup
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { authorizationPolicyService } from '../services/authorizationPolicy';
import { authorizationEngine } from '../services/authorizationEngine';
import { getAllActions } from '../services/authorizationActions';
import { getAllReasons } from '../services/authorizationReasons';

// ---------------------------------------------------------------------
// ADMIN CONTROLLERS
// ---------------------------------------------------------------------

/**
 * GET /api/admin/authorization-policies
 * List all authorization policies with optional query filters.
 */
export async function adminListPolicies(req: Request, res: Response) {
  try {
    const { department, role, action, status } = req.query;
    const policies = await authorizationPolicyService.listPolicies({
      department: department as string,
      role: role as string,
      actionCode: action as string,
      status: status as string
    });

    return res.status(200).json({
      success: true,
      data: { policies, total: policies.length }
    });
  } catch (err: any) {
    console.error('adminListPolicies error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to list policies' }
    });
  }
}

/**
 * GET /api/admin/authorization-policies/:id
 * Retrieve single policy by ID.
 */
export async function adminGetPolicyById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const policy = await authorizationPolicyService.getPolicyById(id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: { code: 'POLICY_NOT_FOUND', message: `Policy with ID ${id} not found.` }
      });
    }

    return res.status(200).json({
      success: true,
      data: { policy }
    });
  } catch (err: any) {
    console.error('adminGetPolicyById error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to retrieve policy' }
    });
  }
}

/**
 * POST /api/admin/authorization-policies
 * Create a new authorization policy (Version 1).
 */
export async function adminCreatePolicy(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'd3b07384-d113-49d7-897b-d24546419777';
    const policy = await authorizationPolicyService.createPolicy(req.body, adminUserId);

    return res.status(201).json({
      success: true,
      data: { policy }
    });
  } catch (err: any) {
    console.error('adminCreatePolicy error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to create policy' }
    });
  }
}

/**
 * POST /api/admin/authorization-policies/:id/version
 * PUT /api/admin/authorization-policies/:id
 * Create a new version of an existing policy (Version N+1).
 */
export async function adminCreatePolicyVersion(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'd3b07384-d113-49d7-897b-d24546419777';
    const { id } = req.params;

    // Resolve policy code from id if needed
    const existing = await authorizationPolicyService.getPolicyById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'POLICY_NOT_FOUND', message: `Policy with ID ${id} not found.` }
      });
    }

    const newVersion = await authorizationPolicyService.createNewVersion(
      existing.policyCode,
      req.body,
      adminUserId
    );

    return res.status(201).json({
      success: true,
      data: { policy: newVersion }
    });
  } catch (err: any) {
    console.error('adminCreatePolicyVersion error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to create policy version' }
    });
  }
}

/**
 * PATCH /api/admin/authorization-policies/:id/status
 * Activate or Deactivate a policy.
 */
export async function adminUpdatePolicyStatus(req: Request, res: Response) {
  try {
    const adminUserId = (req as AuthenticatedRequest).user?.id || 'd3b07384-d113-49d7-897b-d24546419777';
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: { code: 'STATUS_REQUIRED', message: 'Field status is required.' }
      });
    }

    const updated = await authorizationPolicyService.updatePolicyStatus(id, status, adminUserId);

    return res.status(200).json({
      success: true,
      data: { policy: updated }
    });
  } catch (err: any) {
    console.error('adminUpdatePolicyStatus error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to update policy status' }
    });
  }
}

/**
 * GET /api/admin/authorization-actions
 * List Centralized Action Catalog.
 */
export async function adminListActions(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: { actions: getAllActions() }
  });
}

/**
 * GET /api/admin/authorization-reason-codes
 * List Centralized Reason Codes Catalog.
 */
export async function adminListReasonCodes(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: { reasons: getAllReasons() }
  });
}

// ---------------------------------------------------------------------
// CITIZEN CONTROLLERS
// ---------------------------------------------------------------------

/**
 * POST /api/citizen/authorization/evaluate
 * Evaluates requested action safety against configured TrustGov demo policies.
 */
export async function citizenEvaluateAction(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id || null;
    const result = await authorizationEngine.evaluate(req.body, citizenId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('citizenEvaluateAction error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'INTERNAL_ERROR', message: err.message || 'Failed to evaluate action' }
    });
  }
}

/**
 * GET /api/citizen/authorization/evaluations
 * Retrieve evaluation history for logged-in citizen.
 */
export async function citizenGetEvaluations(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to view evaluation history.' }
      });
    }

    const resDb = await pool.query(
      'SELECT * FROM authorization_evaluations WHERE citizen_id = $1 ORDER BY created_at DESC',
      [citizenId]
    );

    return res.status(200).json({
      success: true,
      data: { evaluations: resDb.rows, total: resDb.rows.length }
    });
  } catch (err: any) {
    console.error('citizenGetEvaluations error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evaluation history' }
    });
  }
}

/**
 * GET /api/citizen/authorization/evaluations/:id
 * Retrieve details for a single evaluation belonging to logged-in citizen.
 * Strictly enforces Privacy Isolation: returns 404 RECORD_NOT_FOUND if belongs to another citizen.
 */
export async function citizenGetEvaluationById(req: Request, res: Response) {
  try {
    const citizenId = (req as AuthenticatedRequest).user?.id;
    if (!citizenId) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
    }

    const { id } = req.params;
    const resDb = await pool.query(
      'SELECT * FROM authorization_evaluations WHERE (id = $1 OR evaluation_id = $1) AND citizen_id = $2',
      [id, citizenId]
    );

    if (resDb.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECORD_NOT_FOUND', message: 'Authorization evaluation record not found.' }
      });
    }

    return res.status(200).json({
      success: true,
      data: { evaluation: resDb.rows[0] }
    });
  } catch (err: any) {
    console.error('citizenGetEvaluationById error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch evaluation details' }
    });
  }
}

// ---------------------------------------------------------------------
// OFFICER CONTROLLER
// ---------------------------------------------------------------------

/**
 * GET /api/officer/authorization/scope
 * Retrieve currently configured authorization scope for logged-in officer (View-Only).
 */
export async function officerGetScope(req: Request, res: Response) {
  try {
    const officerUser = (req as AuthenticatedRequest).user;
    if (!officerUser) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' }
      });
    }

    // Resolve officer department and role
    const offRes = await pool.query('SELECT * FROM officers WHERE user_id = $1', [officerUser.id]);
    const department = offRes.rows[0]?.department || 'Demo Central Investigation Bureau';
    const role = offRes.rows[0]?.designation || 'Investigating Officer';

    const scope = await authorizationPolicyService.getOfficerAuthorizationScope(department, role);

    return res.status(200).json({
      success: true,
      data: {
        ...scope,
        officer: {
          officerCode: offRes.rows[0]?.officer_code || 'TG-OFF-001',
          fullName: offRes.rows[0]?.full_name || officerUser.email,
          department,
          designation: role
        },
        disclaimer: 'TrustGov Demo Authorization Policy (Read-Only Scope). Real legal authority is governed by departmental regulations.'
      }
    });
  } catch (err: any) {
    console.error('officerGetScope error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch officer authorization scope' }
    });
  }
}

// ---------------------------------------------------------------------
// PUBLIC CONTROLLER
// ---------------------------------------------------------------------

/**
 * GET /api/verification/public/authorization/:reference
 * Public, sanitized reference lookup for TG-AUTH-XXXXXXXX.
 * Zero citizen PII, zero tokens, zero private keys, marked strictly as historical.
 */
export async function publicGetEvaluationReference(req: Request, res: Response) {
  try {
    const { reference } = req.params;
    const resDb = await pool.query(
      'SELECT * FROM authorization_evaluations WHERE evaluation_id = $1',
      [reference]
    );

    if (resDb.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'RECORD_NOT_FOUND', message: 'No evaluation record found for this reference.' }
      });
    }

    const row = resDb.rows[0];

    // Build sanitized public record
    const publicRecord = {
      evaluationId: row.evaluation_id,
      officerReference: row.officer_reference,
      officerName: row.officer_name,
      department: row.department,
      actionCode: row.action_code,
      policyCode: row.policy_code,
      policyVersion: row.policy_version,
      decision: row.decision,
      riskLevel: row.risk_level,
      reasonCodes: typeof row.reason_codes === 'string' ? JSON.parse(row.reason_codes) : row.reason_codes || [],
      evaluatedAt: row.evaluated_at,
      isHistorical: true,
      disclaimer: 'This is a historical TrustGov evaluation snapshot. Current officer credentials or policies may have changed.'
    };

    return res.status(200).json({
      success: true,
      data: publicRecord
    });
  } catch (err: any) {
    console.error('publicGetEvaluationReference error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to retrieve public evaluation reference' }
    });
  }
}
