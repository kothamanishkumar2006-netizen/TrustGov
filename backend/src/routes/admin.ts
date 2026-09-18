import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/admin';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Dashboard is strictly restricted to ADMIN role
router.get('/dashboard', authenticateToken as any, authorizeRoles('ADMIN') as any, getDashboardMetrics as any);

export default router;
