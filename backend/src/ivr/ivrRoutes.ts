/**
 * TRUSTGOV - PHASE 10: IVR API ROUTING
 * 
 * Defines endpoints for:
 * - Telephony session creation & DTMF input
 * - Repeat prompt & call termination
 * - Simulator reset (dev/admin only)
 * - Rate limiting against automated brute force
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  startCallHandler,
  processInputHandler,
  repeatHandler,
  endCallHandler,
  statusHandler,
  resetSimulatorHandler,
  expireSimulatorHandler
} from './ivrController';

const router = Router();

// IVR Rate limiters
export const ivrCallLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 100000 : 30,
  skip: (req) => process.env.NODE_ENV === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_IVR_CALLS',
      message: 'Too many IVR session creation requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const ivrInputLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: process.env.NODE_ENV === 'test' ? 100000 : 120,
  skip: (req) => process.env.NODE_ENV === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_IVR_INPUTS',
      message: 'Too many keypad input requests, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Routes
router.post('/call/start', ivrCallLimiter, startCallHandler);
router.post('/session/:sessionId/input', ivrInputLimiter, processInputHandler);
router.post('/session/:sessionId/repeat', ivrInputLimiter, repeatHandler);
router.post('/session/:sessionId/end', endCallHandler);
router.get('/session/:sessionId/status', statusHandler);

// Development & Simulator helpers
router.post('/simulator/reset', resetSimulatorHandler);
router.post('/simulator/expire', expireSimulatorHandler);

export default router;
