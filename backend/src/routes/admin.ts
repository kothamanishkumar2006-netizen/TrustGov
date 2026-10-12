import { Router } from 'express';
import { getDashboardMetrics, getSecurityMetrics } from '../controllers/admin';
import { updateCredentialStatus } from '../controllers/credentials';
import { anchorCredentialHandler, anchorDIDHandler } from '../controllers/blockchain';
import { provisionKeyHandler } from '../controllers/verification';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// Dashboard is strictly restricted to ADMIN role
router.get('/dashboard', authenticateToken as any, authorizeRoles('ADMIN') as any, getDashboardMetrics as any);

// Phase 11: Security Metrics Monitoring Endpoint
router.get('/security-metrics', authenticateToken as any, authorizeRoles('ADMIN') as any, getSecurityMetrics as any);

// Phase 4: Credential Status Management
router.patch('/credentials/:id/status', authenticateToken as any, authorizeRoles('ADMIN') as any, updateCredentialStatus as any);

// Phase 5: Blockchain Anchoring
router.post('/credentials/:id/blockchain-anchor', authenticateToken as any, authorizeRoles('ADMIN') as any, anchorCredentialHandler as any);
router.post('/officers/:id/blockchain-anchor-did', authenticateToken as any, authorizeRoles('ADMIN') as any, anchorDIDHandler as any);

// Phase 6: Key Provisioning / Rebinding
router.post('/officers/:id/provision-key', authenticateToken as any, authorizeRoles('ADMIN') as any, provisionKeyHandler as any);

export default router;
