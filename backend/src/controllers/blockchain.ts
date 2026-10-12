/**
 * TRUSTGOV - PHASE 5: Blockchain Registry & Integrity Controllers
 * 
 * Implements:
 * 1. POST /api/admin/credentials/:id/blockchain-anchor (Admin: Anchor Credential)
 * 2. GET /api/credentials/:credentialId/blockchain-verify (Public: Integrity Verification)
 * 3. GET /api/credentials/:credentialId/blockchain-record (Public/Admin: Registry Record)
 * 4. POST /api/admin/officers/:id/blockchain-anchor-did (Admin: Anchor DID)
 */

import { Request, Response } from 'express';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';
import { blockchainService } from '../services/blockchain';
import { verifyCredentialSignature } from '../services/credential';

/**
 * Admin: Anchor an active Verifiable Credential to the blockchain registry
 * POST /api/admin/credentials/:id/blockchain-anchor
 */
export async function anchorCredentialHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // 1. Fetch credential record
    let credRes = await pool.query('SELECT * FROM verifiable_credentials WHERE id = $1', [id]);
    if (credRes.rows.length === 0) {
      credRes = await pool.query('SELECT * FROM verifiable_credentials WHERE credential_id = $1', [id]);
    }

    if (credRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${id}' not found` }
      });
    }

    const cred = credRes.rows[0];
    const payload = typeof cred.credential_payload === 'string'
      ? JSON.parse(cred.credential_payload)
      : cred.credential_payload;

    // 2. Credential validity checks
    if (cred.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        error: { code: 'CREDENTIAL_REVOKED', message: 'Cannot anchor a revoked credential to blockchain' }
      });
    }

    // Cryptographic signature check
    const signatureValid = verifyCredentialSignature(payload);
    if (!signatureValid) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Credential cryptographic signature is invalid' }
      });
    }

    // 3. Check if already anchored in database
    const existingAnchorRes = await pool.query(
      'SELECT * FROM blockchain_registry WHERE credential_id = $1',
      [cred.credential_id]
    );

    if (existingAnchorRes.rows.length > 0) {
      const existing = existingAnchorRes.rows[0];
      return res.status(409).json({
        success: false,
        error: {
          code: 'CREDENTIAL_ALREADY_ANCHORED',
          message: `Credential '${cred.credential_id}' is already anchored to the blockchain`
        },
        data: {
          credentialId: existing.credential_id,
          credentialHash: existing.credential_hash,
          network: existing.blockchain_network,
          chainId: existing.chain_id,
          contractAddress: existing.contract_address,
          transactionHash: existing.transaction_hash,
          blockNumber: Number(existing.block_number),
          status: existing.registry_status,
          anchoredAt: existing.anchored_at
        }
      });
    }

    // 4. Ensure Officer DID is registered on-chain first
    try {
      await blockchainService.registerDID(cred.officer_did);
    } catch (e: any) {
      // If already registered or error, proceed
    }

    // 5. Anchor credential on-chain via smart contract
    const anchorResult = await blockchainService.registerCredential({
      credential: payload,
      officerDid: cred.officer_did,
      issuerDid: cred.issuer_did,
      status: cred.status
    });

    // 6. Persist to blockchain_registry table
    const insertQuery = `
      INSERT INTO blockchain_registry (
        credential_id, officer_id, officer_did, credential_hash,
        officer_did_hash, issuer_did_hash, blockchain_network,
        chain_id, contract_address, transaction_hash, block_number,
        registry_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const insertRes = await pool.query(insertQuery, [
      cred.credential_id,
      cred.officer_id,
      cred.officer_did,
      anchorResult.credentialHash,
      anchorResult.officerDidHash,
      anchorResult.issuerDidHash,
      'hardhat',
      anchorResult.chainId,
      anchorResult.contractAddress,
      anchorResult.transactionHash,
      anchorResult.blockNumber,
      cred.status
    ]);

    const storedAnchor = insertRes.rows[0];

    // 7. Record Audit Log
    await logAudit({
      actorId: req.user?.id || null,
      action: 'BLOCKCHAIN_CREDENTIAL_ANCHORED',
      entityType: 'BLOCKCHAIN_REGISTRY',
      entityId: storedAnchor.id,
      blockchainTxHash: anchorResult.transactionHash,
      metadata: {
        credential_id: cred.credential_id,
        credential_hash: anchorResult.credentialHash,
        officer_did: cred.officer_did,
        contract_address: anchorResult.contractAddress,
        block_number: anchorResult.blockNumber
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Verifiable Credential successfully anchored to blockchain registry',
      data: {
        credentialId: cred.credential_id,
        credentialHash: anchorResult.credentialHash,
        network: 'hardhat',
        chainId: anchorResult.chainId,
        contractAddress: anchorResult.contractAddress,
        transactionHash: anchorResult.transactionHash,
        blockNumber: anchorResult.blockNumber,
        status: cred.status,
        anchoredAt: storedAnchor.anchored_at
      }
    });
  } catch (error: any) {
    console.error('Error anchoring credential to blockchain:', error);
    if (error.code === 'CREDENTIAL_ALREADY_ANCHORED') {
      return res.status(409).json({
        success: false,
        error: { code: 'CREDENTIAL_ALREADY_ANCHORED', message: error.message }
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'BLOCKCHAIN_ERROR', message: error.message || 'Failed to anchor credential to blockchain' }
    });
  }
}

/**
 * Public: Verify Verifiable Credential integrity against blockchain registry
 * GET /api/credentials/:credentialId/blockchain-verify
 */
export async function verifyBlockchainHandler(req: Request, res: Response) {
  try {
    const { credentialId } = req.params;

    // 1. Resolve credential from DB (by credential_id, officer_code, or officer_did)
    const query = `
      SELECT vc.*, o.full_name, o.officer_code, o.status as officer_status, o.department, o.designation
      FROM verifiable_credentials vc
      JOIN officers o ON vc.officer_id = o.id
      WHERE vc.credential_id = $1 OR o.officer_code = $1 OR vc.officer_did = $1
      ORDER BY vc.created_at DESC
      LIMIT 1
    `;
    const credRes = await pool.query(query, [credentialId]);

    if (credRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'CREDENTIAL_NOT_FOUND', message: `Credential '${credentialId}' not found` }
      });
    }

    const cred = credRes.rows[0];
    const payload = typeof cred.credential_payload === 'string'
      ? JSON.parse(cred.credential_payload)
      : cred.credential_payload;

    // 2. Check if an anchor record exists in DB
    const anchorRes = await pool.query(
      'SELECT * FROM blockchain_registry WHERE credential_id = $1',
      [cred.credential_id]
    );

    const anchoredRecord = anchorRes.rows.length > 0 ? anchorRes.rows[0] : null;

    // 3. Verify integrity on-chain
    const integrityResult = await blockchainService.verifyCredentialIntegrity(
      payload,
      anchoredRecord?.credential_hash
    );

    const isMatch = integrityResult.anchored && integrityResult.hashMatch;

    // 4. Audit log
    await logAudit({
      actorId: (req as AuthenticatedRequest).user?.id || null,
      action: !isMatch && integrityResult.reason === 'BLOCKCHAIN_INTEGRITY_MISMATCH'
        ? 'BLOCKCHAIN_INTEGRITY_MISMATCH'
        : 'BLOCKCHAIN_CREDENTIAL_VERIFIED',
      entityType: 'BLOCKCHAIN_REGISTRY',
      entityId: anchoredRecord?.id || null,
      metadata: {
        credential_id: cred.credential_id,
        hash_match: integrityResult.hashMatch,
        blockchain_status: integrityResult.blockchainStatus
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        valid: isMatch,
        credentialId: cred.credential_id,
        anchored: integrityResult.anchored,
        hashMatch: integrityResult.hashMatch,
        credentialRegistered: integrityResult.anchored,
        blockchainStatus: integrityResult.blockchainStatus,
        onChainStatus: integrityResult.blockchainStatus,
        status: integrityResult.blockchainStatus,
        officerStatus: cred.officer_status,
        computedHash: integrityResult.computedHash,
        onChainHash: integrityResult.onChainHash || null,
        transactionHash: anchoredRecord?.transaction_hash || null,
        blockNumber: anchoredRecord?.block_number ? Number(anchoredRecord.block_number) : null,
        contractAddress: anchoredRecord?.contract_address || blockchainService.getContractAddress(),
        network: anchoredRecord?.blockchain_network || 'hardhat',
        blockchainNetwork: anchoredRecord?.blockchain_network || 'hardhat',
        verifiedAt: new Date().toISOString(),
        reason: integrityResult.reason || null
      }
    });
  } catch (error: any) {
    console.error('Error verifying blockchain integrity:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: error.message || 'Failed to verify blockchain integrity' }
    });
  }
}

/**
 * Public/Admin: Get blockchain record for a credential
 * GET /api/credentials/:credentialId/blockchain-record
 */
export async function getBlockchainRecordHandler(req: Request, res: Response) {
  try {
    const { credentialId } = req.params;

    const anchorRes = await pool.query(
      'SELECT * FROM blockchain_registry WHERE credential_id = $1',
      [credentialId]
    );

    if (anchorRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_ANCHORED', message: `Credential '${credentialId}' has not been anchored to the blockchain` }
      });
    }

    const r = anchorRes.rows[0];
    return res.status(200).json({
      success: true,
      data: {
        anchored: true,
        credentialId: r.credential_id,
        officerId: r.officer_id,
        officerDid: r.officer_did,
        credentialHash: r.credential_hash,
        officerDidHash: r.officer_did_hash,
        issuerDidHash: r.issuer_did_hash,
        blockchainNetwork: r.blockchain_network,
        network: r.blockchain_network,
        chainId: r.chain_id,
        contractAddress: r.contract_address,
        transactionHash: r.transaction_hash,
        blockNumber: Number(r.block_number),
        registryStatus: r.registry_status,
        status: r.registry_status,
        anchoredAt: r.anchored_at
      }
    });
  } catch (error: any) {
    console.error('Error fetching blockchain record:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to fetch blockchain record' }
    });
  }
}

/**
 * Admin: Anchor an officer's DID to the blockchain registry
 * POST /api/admin/officers/:id/blockchain-anchor-did
 */
export async function anchorDIDHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // 1. Fetch officer & DID
    const didRes = await pool.query(
      'SELECT * FROM did_identities WHERE officer_id = $1 OR did = $1',
      [id]
    );

    if (didRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'DID_NOT_FOUND', message: `DID identity for officer '${id}' not found` }
      });
    }

    const didRecord = didRes.rows[0];

    // 2. Anchor on-chain
    const anchorResult = await blockchainService.registerDID(didRecord.did);

    // 3. Persist to blockchain_did_registry
    await pool.query(
      `INSERT INTO blockchain_did_registry (
        did, did_hash, blockchain_network, chain_id,
        contract_address, transaction_hash, block_number, registered_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        didRecord.did,
        anchorResult.didHash,
        'hardhat',
        31337,
        blockchainService.getContractAddress(),
        anchorResult.transactionHash,
        anchorResult.blockNumber
      ]
    );

    // 4. Log Audit
    await logAudit({
      actorId: req.user?.id || null,
      action: 'BLOCKCHAIN_DID_ANCHORED',
      entityType: 'BLOCKCHAIN_DID_REGISTRY',
      entityId: didRecord.did,
      blockchainTxHash: anchorResult.transactionHash,
      metadata: {
        did: didRecord.did,
        did_hash: anchorResult.didHash,
        block_number: anchorResult.blockNumber
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Officer DID successfully anchored to blockchain registry',
      data: {
        did: didRecord.did,
        didHash: anchorResult.didHash,
        transactionHash: anchorResult.transactionHash,
        blockNumber: anchorResult.blockNumber
      }
    });
  } catch (error: any) {
    console.error('Error anchoring DID to blockchain:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'BLOCKCHAIN_ERROR', message: error.message || 'Failed to anchor DID to blockchain' }
    });
  }
}
