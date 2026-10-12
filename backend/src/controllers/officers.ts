import { Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { buildDIDDocument } from '../services/crypto';

// Validation Schemas
const createOfficerSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  officer_code: z.string().trim().min(3, 'Officer code must be at least 3 characters'),
  department: z.string().trim().min(2, 'Department is required'),
  designation: z.string().trim().min(2, 'Designation is required'),
  jurisdiction: z.string().trim().min(2, 'Jurisdiction is required'),
  official_email: z.string().trim().email('Invalid official email address'),
  official_phone: z.string().trim().min(10, 'Official phone must be at least 10 digits'),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).default('ACTIVE')
});

const updateOfficerSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  department: z.string().trim().min(2, 'Department is required'),
  designation: z.string().trim().min(2, 'Designation is required'),
  jurisdiction: z.string().trim().min(2, 'Jurisdiction is required'),
  official_phone: z.string().trim().min(10, 'Official phone must be at least 10 digits')
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED'])
});

export async function listOfficers(req: AuthenticatedRequest, res: Response) {
  try {
    const { search, department, status } = req.query;

    const query = `
      SELECT o.id, o.user_id, o.officer_code, o.full_name, o.department, 
             o.designation, o.jurisdiction, o.official_email, o.official_phone, 
             o.status, o.created_at, o.updated_at
      FROM officers o
      ORDER BY o.created_at DESC
    `;

    const result = await pool.query(query);
    let officers = result.rows;

    // Apply filtering (works for both real DB result set and in-memory pool)
    if (search && typeof search === 'string') {
      const q = search.toLowerCase().trim();
      officers = officers.filter((o: any) =>
        (o.full_name && o.full_name.toLowerCase().includes(q)) ||
        (o.officer_code && o.officer_code.toLowerCase().includes(q)) ||
        (o.department && o.department.toLowerCase().includes(q)) ||
        (o.official_email && o.official_email.toLowerCase().includes(q))
      );
    }

    if (department && typeof department === 'string' && department !== 'ALL') {
      officers = officers.filter((o: any) => o.department === department);
    }

    if (status && typeof status === 'string' && status !== 'ALL') {
      officers = officers.filter((o: any) => o.status === status);
    }

    return res.status(200).json({
      success: true,
      data: {
        officers,
        total: officers.length
      }
    });
  } catch (error) {
    console.error('Error listing officers:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to retrieve officers' }
    });
  }
}

export async function getOfficerById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const query = `
      SELECT o.id, o.user_id, o.officer_code, o.full_name, o.department, 
             o.designation, o.jurisdiction, o.official_email, o.official_phone, 
             o.status, o.created_at, o.updated_at
      FROM officers o
      WHERE o.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID ${id} not found` }
      });
    }

    const officer = result.rows[0];

    // Check if DID identity has been issued
    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [id]);
    const didIdentity = didRes.rows.length > 0 ? didRes.rows[0] : null;

    let didDocument = null;
    if (didIdentity) {
      didDocument = buildDIDDocument(
        didIdentity.did,
        didIdentity.public_key,
        didIdentity.status,
        didIdentity.created_at,
        didIdentity.updated_at
      );
    }

    // Phase 4: Check if Verifiable Credential has been issued
    const vcRes = await pool.query('SELECT * FROM verifiable_credentials WHERE officer_id = $1 ORDER BY created_at DESC', [id]);
    const activeCredential = vcRes.rows.find((c: any) => c.status === 'ACTIVE') || (vcRes.rows.length > 0 ? vcRes.rows[0] : null);

    // Phase 5: Check if Blockchain Anchor exists for the active credential
    let blockchainAnchor = null;
    if (activeCredential) {
      const bcRes = await pool.query(
        'SELECT * FROM blockchain_registry WHERE credential_id = $1 ORDER BY created_at DESC LIMIT 1',
        [activeCredential.credential_id]
      );
      if (bcRes.rows.length > 0) {
        blockchainAnchor = bcRes.rows[0];
      }
    }

    // Response includes Phase 3 DID identity details, Phase 4 Verifiable Credential details, Phase 5 Blockchain details
    return res.status(200).json({
      success: true,
      data: {
        officer: {
          ...officer,
          did: didIdentity ? didIdentity.did : officer.did,
          public_key: didIdentity ? didIdentity.public_key : officer.public_key,
          did_identity: didIdentity ? {
            id: didIdentity.id,
            did: didIdentity.did,
            key_type: didIdentity.key_type,
            status: didIdentity.status,
            public_key: didIdentity.public_key,
            created_at: didIdentity.created_at,
            updated_at: didIdentity.updated_at,
            didDocument
          } : null,
          verifiable_credential: activeCredential ? {
            id: activeCredential.id,
            credentialId: activeCredential.credential_id,
            officerDid: activeCredential.officer_did,
            issuerDid: activeCredential.issuer_did,
            credentialType: activeCredential.credential_type,
            status: activeCredential.status,
            issuedAt: activeCredential.issued_at,
            validFrom: activeCredential.valid_from,
            validUntil: activeCredential.valid_until,
            credential: typeof activeCredential.credential_payload === 'string'
              ? JSON.parse(activeCredential.credential_payload)
              : activeCredential.credential_payload
          } : null,
          blockchain_anchor: blockchainAnchor ? {
            id: blockchainAnchor.id,
            credentialId: blockchainAnchor.credential_id,
            credentialHash: blockchainAnchor.credential_hash,
            officerDidHash: blockchainAnchor.officer_did_hash,
            issuerDidHash: blockchainAnchor.issuer_did_hash,
            txHash: blockchainAnchor.transaction_hash || blockchainAnchor.tx_hash,
            blockNumber: blockchainAnchor.block_number,
            contractAddress: blockchainAnchor.contract_address,
            chainId: blockchainAnchor.chain_id,
            status: blockchainAnchor.registry_status || blockchainAnchor.status,
            anchoredAt: blockchainAnchor.anchored_at
          } : null,
          placeholders: {
            did: didIdentity ? didIdentity.did : (officer.did ? officer.did : 'Not issued yet'),
            credential: activeCredential ? activeCredential.credential_id : 'Not issued yet',
            blockchain: blockchainAnchor ? (blockchainAnchor.transaction_hash || blockchainAnchor.tx_hash) : 'Not registered yet'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching officer:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch officer details' }
    });
  }
}

export async function createOfficer(req: AuthenticatedRequest, res: Response) {
  try {
    const validated = createOfficerSchema.parse(req.body);

    // 1. Uniqueness check for officer_code
    const existingCode = await pool.query(
      'SELECT id FROM officers WHERE officer_code = $1',
      [validated.officer_code]
    );
    if (existingCode.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_OFFICER_CODE', message: `Officer code '${validated.officer_code}' is already registered` }
      });
    }

    // 2. Uniqueness check for official_email
    const existingEmail = await pool.query(
      'SELECT id FROM officers WHERE official_email = $1',
      [validated.official_email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'DUPLICATE_OFFICIAL_EMAIL', message: `Official email '${validated.official_email}' is already registered` }
      });
    }

    // 3. Create linked User with OFFICER role
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const userStatus = validated.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';

    const userRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'OFFICER', $5) RETURNING id`,
      [validated.full_name, validated.official_email, validated.official_phone, defaultPasswordHash, userStatus]
    );
    const userId = userRes.rows[0].id;

    // 4. Create Officer record
    const officerRes = await pool.query(
      `INSERT INTO officers (user_id, officer_code, full_name, department, designation, jurisdiction, official_email, official_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        userId,
        validated.officer_code,
        validated.full_name,
        validated.department,
        validated.designation,
        validated.jurisdiction,
        validated.official_email,
        validated.official_phone,
        validated.status
      ]
    );

    const newOfficer = officerRes.rows[0];

    // 5. Audit Log Entry
    await logAudit({
      actorId: req.user?.id || null,
      action: 'OFFICER_CREATED',
      entityType: 'OFFICER',
      entityId: newOfficer.id,
      metadata: {
        officer_code: newOfficer.officer_code,
        full_name: newOfficer.full_name,
        department: newOfficer.department,
        designation: newOfficer.designation,
        official_email: newOfficer.official_email,
        status: newOfficer.status
      }
    });

    return res.status(201).json({
      success: true,
      data: { officer: newOfficer }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    console.error('Error creating officer:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to create officer record' }
    });
  }
}

export async function updateOfficer(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validated = updateOfficerSchema.parse(req.body);

    // Verify officer exists
    const existing = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID ${id} not found` }
      });
    }

    const currentOfficer = existing.rows[0];

    // Update officer
    const updateRes = await pool.query(
      `UPDATE officers SET full_name = $1, department = $2, designation = $3, jurisdiction = $4, official_phone = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
      [validated.full_name, validated.department, validated.designation, validated.jurisdiction, validated.official_phone, id]
    );

    // Sync linked user
    if (currentOfficer.user_id) {
      await pool.query(
        'UPDATE users SET name = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [validated.full_name, validated.official_phone, currentOfficer.user_id]
      );
    }

    const updated = updateRes.rows[0];

    // Audit Log
    await logAudit({
      actorId: req.user?.id || null,
      action: 'OFFICER_UPDATED',
      entityType: 'OFFICER',
      entityId: id,
      metadata: {
        officer_code: updated.officer_code,
        previous: {
          full_name: currentOfficer.full_name,
          department: currentOfficer.department,
          designation: currentOfficer.designation
        },
        updated: validated
      }
    });

    return res.status(200).json({
      success: true,
      data: { officer: updated }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    console.error('Error updating officer:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update officer record' }
    });
  }
}

export async function updateOfficerStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = statusSchema.parse(req.body);

    const existing = await pool.query('SELECT * FROM officers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'OFFICER_NOT_FOUND', message: `Officer with ID ${id} not found` }
      });
    }

    const currentOfficer = existing.rows[0];
    const previousStatus = currentOfficer.status;

    // Update officer status
    const updateRes = await pool.query(
      'UPDATE officers SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    // Cascade to linked user
    if (currentOfficer.user_id) {
      const userStatus = status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
      await pool.query(
        'UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [userStatus, currentOfficer.user_id]
      );
    }

    // Phase 3: Cascade status change to linked DID identity
    const didRes = await pool.query('SELECT * FROM did_identities WHERE officer_id = $1', [id]);
    if (didRes.rows.length > 0) {
      const prevDidStatus = didRes.rows[0].status;
      if (prevDidStatus !== status) {
        await pool.query(
          'UPDATE did_identities SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE officer_id = $2',
          [status, id]
        );

        // Audit log for DID status synchronization
        await logAudit({
          actorId: req.user?.id || null,
          action: 'DID_STATUS_CHANGED',
          entityType: 'DID_IDENTITY',
          entityId: didRes.rows[0].id,
          metadata: {
            officer_id: id,
            did: didRes.rows[0].did,
            previous_status: prevDidStatus,
            new_status: status
          }
        });
      }
    }

    // Phase 4 & Phase 5: Cascade status change to linked Verifiable Credentials and Blockchain Records
    if (status === 'SUSPENDED') {
      const activeVcs = await pool.query(
        "SELECT * FROM verifiable_credentials WHERE officer_id = $1 AND status = 'ACTIVE'",
        [id]
      );
      if (activeVcs.rows.length > 0) {
        await pool.query(
          "UPDATE verifiable_credentials SET status = 'SUSPENDED', suspended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE officer_id = $1 AND status = 'ACTIVE'",
          [id]
        );
        for (const vc of activeVcs.rows) {
          await logAudit({
            actorId: req.user?.id || null,
            action: 'CREDENTIAL_SUSPENDED',
            entityType: 'VERIFIABLE_CREDENTIAL',
            entityId: vc.id,
            metadata: {
              credential_id: vc.credential_id,
              officer_id: id,
              cascade_reason: 'OFFICER_SUSPENDED'
            }
          });

          // Phase 5: Sync to blockchain if anchored
          try {
            const bcRes = await pool.query('SELECT * FROM blockchain_registry WHERE credential_id = $1', [vc.credential_id]);
            if (bcRes.rows.length > 0) {
              const { blockchainService } = await import('../services/blockchain');
              const receipt = await blockchainService.updateCredentialStatus(bcRes.rows[0].credential_hash, 'SUSPENDED');
              await pool.query(
                'UPDATE blockchain_registry SET registry_status = $1, transaction_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE credential_id = $3',
                ['SUSPENDED', receipt.transactionHash, vc.credential_id]
              );
            }
          } catch (bcErr: any) {
            console.warn('Phase 5 officer suspend cascade warning:', bcErr?.message || bcErr);
          }
        }
      }
    } else if (status === 'REVOKED') {
      const nonRevokedVcs = await pool.query(
        "SELECT * FROM verifiable_credentials WHERE officer_id = $1 AND status != 'REVOKED'",
        [id]
      );
      if (nonRevokedVcs.rows.length > 0) {
        await pool.query(
          "UPDATE verifiable_credentials SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE officer_id = $1 AND status != 'REVOKED'",
          [id]
        );
        for (const vc of nonRevokedVcs.rows) {
          await logAudit({
            actorId: req.user?.id || null,
            action: 'CREDENTIAL_REVOKED',
            entityType: 'VERIFIABLE_CREDENTIAL',
            entityId: vc.id,
            metadata: {
              credential_id: vc.credential_id,
              officer_id: id,
              cascade_reason: 'OFFICER_REVOKED'
            }
          });

          // Phase 5: Sync to blockchain if anchored
          try {
            const bcRes = await pool.query('SELECT * FROM blockchain_registry WHERE credential_id = $1', [vc.credential_id]);
            if (bcRes.rows.length > 0) {
              const { blockchainService } = await import('../services/blockchain');
              const receipt = await blockchainService.updateCredentialStatus(bcRes.rows[0].credential_hash, 'REVOKED');
              await pool.query(
                'UPDATE blockchain_registry SET registry_status = $1, transaction_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE credential_id = $3',
                ['REVOKED', receipt.transactionHash, vc.credential_id]
              );
            }
          } catch (bcErr: any) {
            console.warn('Phase 5 officer revoke cascade warning:', bcErr?.message || bcErr);
          }
        }
      }
    }

    const updated = updateRes.rows[0];

    // Determine specific audit action
    const auditAction = status === 'ACTIVE'
      ? 'OFFICER_ACTIVATED'
      : (status === 'SUSPENDED' ? 'OFFICER_SUSPENDED' : 'OFFICER_REVOKED');

    await logAudit({
      actorId: req.user?.id || null,
      action: auditAction,
      entityType: 'OFFICER',
      entityId: id,
      metadata: {
        officer_code: updated.officer_code,
        previous_status: previousStatus,
        new_status: status
      }
    });

    return res.status(200).json({
      success: true,
      data: { officer: updated }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    console.error('Error updating officer status:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to update officer status' }
    });
  }
}
