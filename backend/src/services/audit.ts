import { pool } from '../config/db';

export interface AuditLogParams {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: any;
  blockchainTxHash?: string | null;
}

export async function logAudit(params: AuditLogParams): Promise<void> {
  const { actorId, action, entityType, entityId = null, metadata = {}, blockchainTxHash = null } = params;
  try {
    const query = `
      INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, blockchain_tx_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [
      actorId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      blockchainTxHash
    ]);
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
