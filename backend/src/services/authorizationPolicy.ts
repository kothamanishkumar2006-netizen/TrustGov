/**
 * TRUSTGOV - PHASE 8: AUTHORIZATION POLICY SERVICE
 * Manages versioned declarative authorization policies, immutability, and audit events.
 */

import { pool } from '../config/db';
import {
  AuthorizationPolicy,
  AuthorizationPolicyStatus,
  AuthorizationDecision,
  ActionCode,
  PolicyConstraints
} from '../types/authorization';
import { isValidActionCode } from './authorizationActions';
import { logAudit } from './audit';

export interface CreatePolicyInput {
  policyCode: string;
  department: string;
  role: string;
  actionCode: ActionCode;
  decision: AuthorizationDecision;
  constraints?: PolicyConstraints;
  description: string;
  effectiveFrom?: string | Date;
  effectiveTo?: string | Date | null;
}

export class AuthorizationPolicyService {
  /**
   * Create a new Authorization Policy (Version 1)
   */
  async createPolicy(input: CreatePolicyInput, adminUserId: string): Promise<AuthorizationPolicy> {
    if (!input.policyCode || typeof input.policyCode !== 'string') {
      throw { statusCode: 400, code: 'INVALID_POLICY_CODE', message: 'Valid policyCode is required.' };
    }
    if (!input.department || !input.role) {
      throw { statusCode: 400, code: 'INVALID_METADATA', message: 'Department and role are required.' };
    }
    if (!isValidActionCode(input.actionCode)) {
      throw { statusCode: 400, code: 'INVALID_ACTION_CODE', message: `Invalid actionCode: ${input.actionCode}` };
    }
    const validDecisions: AuthorizationDecision[] = ['ALLOW', 'DENY', 'REVIEW'];
    if (!validDecisions.includes(input.decision)) {
      throw { statusCode: 400, code: 'INVALID_DECISION', message: `Decision must be one of: ${validDecisions.join(', ')}` };
    }

    const trimmedCode = input.policyCode.trim().toUpperCase();
    const version = 1;

    // Check if policyCode + version already exists
    const existing = await pool.query(
      'SELECT id FROM authorization_policies WHERE policy_code = $1 AND version = $2',
      [trimmedCode, version]
    );
    if (existing.rows.length > 0) {
      throw {
        statusCode: 409,
        code: 'POLICY_ALREADY_EXISTS',
        message: `Policy ${trimmedCode} version ${version} already exists. To update, create a new version.`
      };
    }

    const constraints = input.constraints || {};
    const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
    const effectiveTo = input.effectiveTo ? new Date(input.effectiveTo) : null;

    const res = await pool.query(
      `INSERT INTO authorization_policies (
        policy_code, version, department, role, action_code, decision,
        constraints, description, status, effective_from, effective_to, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        trimmedCode,
        version,
        input.department.trim(),
        input.role.trim(),
        input.actionCode,
        input.decision,
        JSON.stringify(constraints),
        input.description.trim(),
        'ACTIVE',
        effectiveFrom,
        effectiveTo,
        adminUserId
      ]
    );

    const created = this.mapRowToPolicy(res.rows[0]);

    await logAudit({
      actorId: adminUserId,
      action: 'AUTHORIZATION_POLICY_CREATED',
      entityType: 'AUTHORIZATION_POLICY',
      entityId: created.id,
      metadata: {
        policyCode: created.policyCode,
        version: created.version,
        department: created.department,
        role: created.role,
        actionCode: created.actionCode,
        decision: created.decision
      }
    });

    return created;
  }

  /**
   * Create a new version of an existing policy (e.g. Version 1 -> Version 2)
   * Historical versions remain completely immutable.
   */
  async createNewVersion(
    policyCode: string,
    updates: Partial<CreatePolicyInput>,
    adminUserId: string
  ): Promise<AuthorizationPolicy> {
    const trimmedCode = policyCode.trim().toUpperCase();

    // Retrieve existing versions sorted by version desc
    const versionsRes = await pool.query(
      'SELECT * FROM authorization_policies WHERE policy_code = $1 ORDER BY version DESC',
      [trimmedCode]
    );

    if (versionsRes.rows.length === 0) {
      throw { statusCode: 404, code: 'POLICY_NOT_FOUND', message: `Policy with code ${trimmedCode} not found.` };
    }

    const latest = this.mapRowToPolicy(versionsRes.rows[0]);
    const newVersion = latest.version + 1;

    const department = updates.department?.trim() || latest.department;
    const role = updates.role?.trim() || latest.role;
    const actionCode = (updates.actionCode || latest.actionCode) as ActionCode;
    const decision = (updates.decision || latest.decision) as AuthorizationDecision;
    const constraints = updates.constraints !== undefined ? updates.constraints : latest.constraints;
    const description = updates.description?.trim() || latest.description;
    const effectiveFrom = updates.effectiveFrom ? new Date(updates.effectiveFrom) : new Date();
    const effectiveTo = updates.effectiveTo !== undefined ? (updates.effectiveTo ? new Date(updates.effectiveTo) : null) : latest.effectiveTo;

    // Set previous version(s) to INACTIVE
    await pool.query(
      "UPDATE authorization_policies SET status = 'INACTIVE' WHERE policy_code = $1",
      [trimmedCode, newVersion]
    );

    const res = await pool.query(
      `INSERT INTO authorization_policies (
        policy_code, version, department, role, action_code, decision,
        constraints, description, status, effective_from, effective_to, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        trimmedCode,
        newVersion,
        department,
        role,
        actionCode,
        decision,
        JSON.stringify(constraints),
        description,
        'ACTIVE',
        effectiveFrom,
        effectiveTo,
        adminUserId
      ]
    );

    const created = this.mapRowToPolicy(res.rows[0]);

    await logAudit({
      actorId: adminUserId,
      action: 'AUTHORIZATION_POLICY_VERSION_CREATED',
      entityType: 'AUTHORIZATION_POLICY',
      entityId: created.id,
      metadata: {
        policyCode: created.policyCode,
        version: created.version,
        previousVersion: latest.version,
        actionCode: created.actionCode,
        decision: created.decision
      }
    });

    return created;
  }

  /**
   * Update Status of a Policy (ACTIVE, INACTIVE, EXPIRED)
   */
  async updatePolicyStatus(
    policyId: string,
    newStatus: AuthorizationPolicyStatus,
    adminUserId: string
  ): Promise<AuthorizationPolicy> {
    const validStatuses: AuthorizationPolicyStatus[] = ['ACTIVE', 'INACTIVE', 'EXPIRED'];
    if (!validStatuses.includes(newStatus)) {
      throw { statusCode: 400, code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` };
    }

    const checkRes = await pool.query('SELECT * FROM authorization_policies WHERE id = $1', [policyId]);
    if (checkRes.rows.length === 0) {
      throw { statusCode: 404, code: 'POLICY_NOT_FOUND', message: 'Policy not found.' };
    }

    const policy = this.mapRowToPolicy(checkRes.rows[0]);

    const updateRes = await pool.query(
      'UPDATE authorization_policies SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newStatus, policyId]
    );

    const updated = this.mapRowToPolicy(updateRes.rows[0] || { ...checkRes.rows[0], status: newStatus });

    const auditAction = newStatus === 'ACTIVE'
      ? 'AUTHORIZATION_POLICY_ACTIVATED'
      : 'AUTHORIZATION_POLICY_DEACTIVATED';

    await logAudit({
      actorId: adminUserId,
      action: auditAction,
      entityType: 'AUTHORIZATION_POLICY',
      entityId: updated.id,
      metadata: {
        policyCode: updated.policyCode,
        version: updated.version,
        oldStatus: policy.status,
        newStatus: updated.status
      }
    });

    return updated;
  }

  /**
   * Retrieve Policy by ID
   */
  async getPolicyById(policyId: string): Promise<AuthorizationPolicy | null> {
    const res = await pool.query('SELECT * FROM authorization_policies WHERE id = $1', [policyId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToPolicy(res.rows[0]);
  }

  /**
   * List all policies with optional filters
   */
  async listPolicies(filters?: {
    department?: string;
    role?: string;
    actionCode?: string;
    status?: string;
  }): Promise<AuthorizationPolicy[]> {
    const res = await pool.query('SELECT * FROM authorization_policies ORDER BY created_at DESC');
    let policies: AuthorizationPolicy[] = res.rows.map((r: any) => this.mapRowToPolicy(r));

    if (filters) {
      if (filters.status) {
        policies = policies.filter((p: AuthorizationPolicy) => p.status.toUpperCase() === filters.status!.toUpperCase());
      }
      if (filters.department) {
        policies = policies.filter((p: AuthorizationPolicy) =>
          p.department.toLowerCase().includes(filters.department!.toLowerCase()) || p.department === 'ALL'
        );
      }
      if (filters.role) {
        policies = policies.filter((p: AuthorizationPolicy) =>
          p.role.toLowerCase().includes(filters.role!.toLowerCase()) || p.role === 'ALL'
        );
      }
      if (filters.actionCode) {
        policies = policies.filter((p: AuthorizationPolicy) => p.actionCode === filters.actionCode);
      }
    }

    return policies;
  }

  /**
   * Find matching active policy for evaluation
   */
  async findActivePolicy(
    department: string,
    role: string,
    actionCode: ActionCode
  ): Promise<AuthorizationPolicy | null> {
    const res = await pool.query(
      `SELECT * FROM authorization_policies
       WHERE (department = $1 OR department = 'ALL')
         AND (role = $2 OR role = 'ALL')
         AND action_code = $3
         AND status = 'ACTIVE'
       ORDER BY version DESC LIMIT 1`,
      [department, role, actionCode]
    );

    if (res.rows.length === 0) return null;
    return this.mapRowToPolicy(res.rows[0]);
  }

  /**
   * Get Authorization Scope for an Officer (View-only)
   */
  async getOfficerAuthorizationScope(department: string, role: string): Promise<{
    department: string;
    role: string;
    activePolicies: AuthorizationPolicy[];
    allowedActions: ActionCode[];
    prohibitedActions: ActionCode[];
  }> {
    const res = await pool.query(
      `SELECT * FROM authorization_policies
       WHERE (department = $1 OR department = 'ALL')
         AND (role = $2 OR role = 'ALL')
         AND status = 'ACTIVE'
       ORDER BY action_code ASC, version DESC`,
      [department, role]
    );

    const activePolicies: AuthorizationPolicy[] = res.rows.map((r: any) => this.mapRowToPolicy(r));
    const allowedActions: ActionCode[] = [];
    const prohibitedActions: ActionCode[] = [];

    activePolicies.forEach(p => {
      if (p.decision === 'ALLOW') {
        if (!allowedActions.includes(p.actionCode)) allowedActions.push(p.actionCode);
      } else if (p.decision === 'DENY') {
        if (!prohibitedActions.includes(p.actionCode)) prohibitedActions.push(p.actionCode);
      }
    });

    return {
      department,
      role,
      activePolicies,
      allowedActions,
      prohibitedActions
    };
  }

  private mapRowToPolicy(row: any): AuthorizationPolicy {
    return {
      id: row.id,
      policyCode: row.policy_code,
      version: Number(row.version),
      department: row.department,
      role: row.role,
      actionCode: row.action_code as ActionCode,
      decision: row.decision as AuthorizationDecision,
      constraints: typeof row.constraints === 'string' ? JSON.parse(row.constraints) : row.constraints || {},
      description: row.description,
      status: row.status as AuthorizationPolicyStatus,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const authorizationPolicyService = new AuthorizationPolicyService();
