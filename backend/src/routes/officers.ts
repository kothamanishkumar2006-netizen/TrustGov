import { Router } from 'express';
import {
  listOfficers,
  getOfficerById,
  createOfficer,
  updateOfficer,
  updateOfficerStatus
} from '../controllers/officers';
import { issueOfficerDID, getOfficerDID } from '../controllers/did';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// All officer management routes are strictly restricted to authenticated ADMIN users
router.use(authenticateToken as any);
router.use(authorizeRoles('ADMIN') as any);

router.get('/', listOfficers as any);
router.get('/:id', getOfficerById as any);
router.post('/', createOfficer as any);
router.put('/:id', updateOfficer as any);
router.patch('/:id/status', updateOfficerStatus as any);

// Phase 3: DID Management routes for officers
router.post('/:id/did', issueOfficerDID as any);
router.get('/:id/did', getOfficerDID as any);

export default router;
