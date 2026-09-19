import { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../config/db';
import { AuthenticatedRequest } from '../middleware/auth';
import { logAudit } from '../services/audit';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production';

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export async function registerCitizen(req: AuthenticatedRequest, res: Response) {
  try {
    const validated = registerSchema.parse(req.body);

    // Check if email already exists
    const checkEmail = await pool.query('SELECT id FROM users WHERE email = $1', [validated.email]);
    if (checkEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: 'Email address is already registered' }
      });
    }

    const passwordHash = await bcrypt.hash(validated.password, 10);

    const userRes = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'CITIZEN', 'ACTIVE') RETURNING id, name, email, role, status`,
      [validated.name, validated.email, validated.phone, passwordHash]
    );

    const user = userRes.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    // Audit log
    await logAudit({
      actorId: user.id,
      action: 'CITIZEN_REGISTRATION',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email: user.email }
    });

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error occurred' }
    });
  }
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const validated = loginSchema.parse(req.body);

    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [validated.email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const user = userRes.rows[0];

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_SUSPENDED', message: `Your account status is ${user.status.toLowerCase()}` }
      });
    }

    const match = await bcrypt.compare(validated.password, user.password_hash);
    if (!match) {
      // Audit login failure
      await logAudit({
        actorId: null,
        action: 'FAILED_LOGIN_ATTEMPT',
        entityType: 'USER',
        entityId: user.id,
        metadata: { email: user.email }
      });

      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    // Audit login success
    await logAudit({
      actorId: user.id,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: user.id
    });

    return res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error occurred' }
    });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user) {
      await logAudit({
        actorId: req.user.id,
        action: 'USER_LOGOUT',
        entityType: 'USER',
        entityId: req.user.id
      });
    }
    return res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error occurred' }
    });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
      });
    }

    const userId = req.user.id;
    const userQuery = 'SELECT id, name, email, phone, role, status FROM users WHERE id = $1';
    const userRes = await pool.query(userQuery, [userId]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User profile not found' }
      });
    }

    const profile = userRes.rows[0];

    // If user is an officer, fetch extra officer metadata
    if (profile.role === 'OFFICER') {
      const officerQuery = `
        SELECT o.id as officer_id, o.officer_code, o.department, o.designation, o.jurisdiction, 
               COALESCE(d.did, o.did) as did, 
               COALESCE(d.public_key, o.public_key) as public_key, 
               COALESCE(d.key_type, 'Ed25519') as key_type, 
               COALESCE(d.status, o.status) as did_status, 
               c.status as credential_status, 
               c.expires_at
        FROM officers o
        LEFT JOIN credentials c ON o.id = c.officer_id
        LEFT JOIN did_identities d ON o.id = d.officer_id
        WHERE o.user_id = $1
      `;
      const officerRes = await pool.query(officerQuery, [userId]);
      if (officerRes.rows.length > 0) {
        return res.status(200).json({
          success: true,
          data: {
            user: profile,
            officerDetails: officerRes.rows[0]
          }
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: { user: profile }
    });
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error occurred' }
    });
  }
}
