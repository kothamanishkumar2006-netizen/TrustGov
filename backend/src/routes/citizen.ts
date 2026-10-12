import { Router } from 'express';
import {
  verifyOfficerHandler,
  getVerificationHistoryHandler,
  getVerificationDetailsHandler
} from '../controllers/citizen';
import { authenticateToken, optionalAuthenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Unified Citizen Verification (supports both guest citizens and authenticated citizens)
router.post('/verify', optionalAuthenticateToken as any, verifyOfficerHandler as any);

// Authenticated Citizen History
router.get('/verifications', authenticateToken as any, authorizeRoles('CITIZEN', 'ADMIN') as any, getVerificationHistoryHandler as any);
router.get('/verifications/:id', authenticateToken as any, authorizeRoles('CITIZEN', 'ADMIN') as any, getVerificationDetailsHandler as any);

export default router;
