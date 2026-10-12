import { Router } from 'express';
import {
  createChallengeHandler,
  verifyProofHandler,
  resolveQRHandler
} from '../controllers/verification';
import { getPublicVerificationReferenceHandler } from '../controllers/citizen';

const router = Router();

// Public Verification Endpoints
router.post('/challenge', createChallengeHandler as any);
router.post('/verify-proof', verifyProofHandler as any);
router.post('/qr-resolve', resolveQRHandler as any);
router.get('/public/:reference', getPublicVerificationReferenceHandler as any);

export default router;

