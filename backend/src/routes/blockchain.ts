import { Router } from 'express';
import {
  anchorCredentialHandler,
  verifyBlockchainHandler,
  getBlockchainRecordHandler
} from '../controllers/blockchain';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Frontend compatibility routes (literal subpaths MUST precede :credentialId)
router.get('/credentials/:credentialId/verify', verifyBlockchainHandler as any);
router.get('/credentials/:credentialId/record', getBlockchainRecordHandler as any);
router.get('/credentials/:credentialId', getBlockchainRecordHandler as any);

// Public blockchain integrity verification & record retrieval
router.get('/:credentialId/verify', verifyBlockchainHandler as any);
router.get('/:credentialId/record', getBlockchainRecordHandler as any);

// Admin-only anchoring
router.post('/credentials/:id/anchor', authenticateToken as any, authorizeRoles('ADMIN') as any, anchorCredentialHandler as any);

export default router;
