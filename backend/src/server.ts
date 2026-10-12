import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environmental config
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { validateEnvironment } from './config/envValidation';

// Validate environment on boot
try {
  validateEnvironment();
} catch (err: any) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Fatal boot error:', err.message);
    process.exit(1);
  }
}

import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import officerRoutes from './routes/officers';
import didRoutes from './routes/did';
import credentialRoutes from './routes/credentials';
import officerPortalRoutes from './routes/officerPortal';
import blockchainRoutes from './routes/blockchain';
import verificationRoutes from './routes/verification';
import citizenRoutes from './routes/citizen';
import authorizationRoutes from './routes/authorization';
import reportRoutes from './routes/reports';
import ivrRoutes from './ivr/ivrRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers via Helmet (Phase 11 Hardening)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS Configuration (Phase 11 Hardening)
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '25mb' }));

// Rate Limiting: 100 requests per 15 minutes max (relaxed for testing/localhost)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100000 : 1000,
  skip: (req) => process.env.NODE_ENV === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Phase 6: Targeted Rate Limiting for verification challenge creation & proof checking
const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100000 : 60,
  skip: (req) => process.env.NODE_ENV === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_VERIFICATION_REQUESTS',
      message: 'Too many verification attempts, please try again after 5 minutes.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/officers', officerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/did', didRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/officer', officerPortalRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/verification', verificationLimiter, verificationRoutes);
app.use('/api/citizen', verificationLimiter, citizenRoutes);
app.use('/api', verificationLimiter, authorizationRoutes);
app.use('/api', verificationLimiter, reportRoutes);
app.use('/api/ivr', ivrRoutes);

// Health check endpoints (Safe, zero-secret responses)
app.get(['/health', '/api/health'], (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'TrustGov API service is healthy',
    service: 'trustgov',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoints (Safe dependency readiness check)
app.get(['/ready', '/api/ready'], (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ready',
    service: 'trustgov',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

// 404 Route handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'The requested API endpoint does not exist' }
  });
});

// Global Error Handler (Hides server stack traces)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File or payload exceeds maximum allowable size of 10MB.'
      }
    });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'A generic server error occurred. Please contact the administrator.'
    }
  });
});

app.listen(PORT, () => {
  console.log(`TrustGov Backend running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
