/**
 * TRUSTGOV - PHASE 11: PRODUCTION ENVIRONMENT VALIDATION
 * 
 * Enforces startup guards to prevent running in production with:
 * - Default/weak JWT secrets
 * - Missing required database configuration
 * - Insecure CORS wildcard configs
 * 
 * Never prints secret values to console.
 */

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  const devPlaceholder = 'super-secret-jwt-key-change-in-production';

  // 1. JWT Secret Verification
  if (!jwtSecret || jwtSecret.trim() === '') {
    if (isProduction) {
      errors.push('CRITICAL: JWT_SECRET environment variable is missing in production mode.');
    } else {
      warnings.push('JWT_SECRET is unset; falling back to development placeholder.');
    }
  } else if (jwtSecret === devPlaceholder || jwtSecret.toLowerCase().includes('change-in-production')) {
    if (isProduction) {
      errors.push('CRITICAL: JWT_SECRET is set to a known insecure development placeholder in production.');
    } else {
      warnings.push('JWT_SECRET is using development placeholder.');
    }
  } else if (isProduction && jwtSecret.length < 32) {
    errors.push('CRITICAL: JWT_SECRET must be at least 32 characters long in production.');
  }

  // 2. Database Connection Security
  if (isProduction) {
    if (!process.env.DATABASE_URL && !(process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD)) {
      errors.push('CRITICAL: Production requires explicit DATABASE_URL or DB_HOST/DB_USER/DB_PASSWORD.');
    }
  }

  // 3. CORS Configuration
  if (isProduction) {
    const corsOrigin = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CORS_ORIGINS;
    if (!corsOrigin || corsOrigin === '*') {
      warnings.push('CORS origin is wildcard or unconfigured in production. Restrict to trusted domains.');
    }
  }

  if (isProduction && errors.length > 0) {
    console.error('====================================================');
    console.error('TRUSTGOV PRODUCTION ENVIRONMENT VALIDATION FAILED:');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('Server execution aborted for security.');
    console.error('====================================================');
    throw new Error(`Production environment validation failed with ${errors.length} critical errors.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
