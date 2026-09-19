import { Router } from 'express';
import { resolveDID } from '../controllers/did';

const router = Router();

// Public DID Resolution endpoint: GET /api/did/:did
router.get('/:did', resolveDID as any);

export default router;
