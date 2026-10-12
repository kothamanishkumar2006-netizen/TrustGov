import { Router } from 'express';
import {
  getCredentialById,
  verifyCredentialHandler,
  verifyRawCredentialHandler,
  updateCredentialStatus
} from '../controllers/credentials';
import {
  verifyBlockchainHandler,
  getBlockchainRecordHandler,
  anchorCredentialHandler
} from '../controllers/blockchain';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Public Credential Verification & Retrieval
router.get('/:credentialId/verify', verifyCredentialHandler as any);
router.post('/verify', verifyRawCredentialHandler as any);
router.get('/:credentialId', getCredentialById as any);

// Phase 5: Blockchain Verification & Integrity Check
router.get('/:credentialId/blockchain-verify', verifyBlockchainHandler as any);
router.get('/:credentialId/blockchain-record', getBlockchainRecordHandler as any);

// Admin-only Credential Status Lifecycle Management & Blockchain Anchoring
router.patch('/:id/status', authenticateToken as any, authorizeRoles('ADMIN') as any, updateCredentialStatus as any);
router.post('/:id/blockchain-anchor', authenticateToken as any, authorizeRoles('ADMIN') as any, anchorCredentialHandler as any);

export default router;
