import { Router } from 'express';
import { getMyCredentials } from '../controllers/credentials';
import { signProofHandler, getPendingChallengesHandler } from '../controllers/verification';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Strictly restricted to authenticated OFFICER role
router.use(authenticateToken as any);
router.use(authorizeRoles('OFFICER') as any);

// Phase 4: Officer's own Verifiable Credentials
router.get('/credentials', getMyCredentials as any);

// Phase 6: Officer Proof of Possession
router.post('/proof/sign', signProofHandler as any);
router.get('/proof/pending', getPendingChallengesHandler as any);

export default router;

