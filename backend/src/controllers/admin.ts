import { Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';

export async function getDashboardMetrics(req: AuthenticatedRequest, res: Response) {
  try {
    // 1. Core Metrics
    const usersCount = await pool.query('SELECT COUNT(*)::int as count FROM users');
    const officersCount = await pool.query('SELECT COUNT(*)::int as count FROM officers');
    const activeCreds = await pool.query("SELECT COUNT(*)::int as count FROM credentials WHERE status = 'ACTIVE'");
    const revokedCreds = await pool.query("SELECT COUNT(*)::int as count FROM credentials WHERE status = 'REVOKED'");
    const verificationsToday = await pool.query("SELECT COUNT(*)::int as count FROM verification_sessions WHERE created_at >= CURRENT_DATE");
    const failedVerifications = await pool.query("SELECT COUNT(*)::int as count FROM verification_sessions WHERE status = 'FAILED'");
    const scamReports = await pool.query('SELECT COUNT(*)::int as count FROM scam_reports');
    const highRiskReports = await pool.query("SELECT COUNT(*)::int as count FROM scam_reports WHERE risk_level IN ('HIGH', 'CRITICAL')");

    // 2. Recent Officers
    const recentOfficers = await pool.query(`
      SELECT o.id, u.name, u.email, o.officer_code, o.department, o.designation, o.status, o.created_at
      FROM officers o
      JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    // 3. Recent Audit Logs
    const recentAuditLogs = await pool.query(`
      SELECT a.id, u.name as actor_name, u.email as actor_email, u.role as actor_role, a.action, a.entity_type, a.created_at
      FROM audit_logs a
      LEFT JOIN users u ON a.actor_id = u.id
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    // 4. Recent Scam Reports
    const recentScams = await pool.query(`
      SELECT id, caller_number, claimed_department, claimed_officer_name, payment_amount, risk_level, status, created_at
      FROM scam_reports
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // 5. Recent Verification Attempts
    const recentVerifications = await pool.query(`
      SELECT vs.id, vs.session_id, o.officer_code, u_officer.name as officer_name, u_citizen.name as citizen_name, vs.status, vs.created_at
      FROM verification_sessions vs
      JOIN officers o ON vs.officer_id = o.id
      JOIN users u_officer ON o.user_id = u_officer.id
      LEFT JOIN users u_citizen ON vs.citizen_id = u_citizen.id
      ORDER BY vs.created_at DESC
      LIMIT 5
    `);

    return res.status(200).json({
      success: true,
      data: {
        metrics: {
          totalUsers: usersCount.rows[0].count,
          totalOfficers: officersCount.rows[0].count,
          activeCredentials: activeCreds.rows[0].count,
          revokedCredentials: revokedCreds.rows[0].count,
          verificationsToday: verificationsToday.rows[0].count,
          failedVerifications: failedVerifications.rows[0].count,
          scamReports: scamReports.rows[0].count,
          highRiskReports: highRiskReports.rows[0].count
        },
        recentOfficers: recentOfficers.rows,
        recentAuditLogs: recentAuditLogs.rows,
        recentScams: recentScams.rows,
        recentVerifications: recentVerifications.rows
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch dashboard metrics' }
    });
  }
}
