import { Router } from 'express';
import { registerCitizen, login, logout, getMe } from '../controllers/auth';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', registerCitizen as any);
router.post('/login', login as any);

// Protected routes
router.post('/logout', authenticateToken as any, logout as any);
router.get('/me', authenticateToken as any, getMe as any);

export default router;
