-- Phase 7 Migration: Citizen Verification History & Trust Experience
-- Creates citizen_verification_history table for storing safe, non-sensitive audit references of citizen verification checks
-- CRITICAL SECURITY RULE: No passwords, private keys, JWTs, camera frames, or QR images stored in this table.

CREATE TABLE IF NOT EXISTS citizen_verification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id VARCHAR(255) UNIQUE NOT NULL,
    citizen_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_method VARCHAR(50) NOT NULL, -- 'QR', 'OFFICER_CODE', 'CREDENTIAL_ID', 'DID'
    officer_reference VARCHAR(255),
    officer_name VARCHAR(255),
    department VARCHAR(255),
    credential_reference VARCHAR(255),
    result VARCHAR(50) NOT NULL, -- 'VERIFIED', 'FAILED', 'INCOMPLETE'
    failure_reason TEXT,
    checks_summary JSONB,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance and privacy lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_cvh_verification_id ON citizen_verification_history(verification_id);
CREATE INDEX IF NOT EXISTS idx_cvh_citizen_id ON citizen_verification_history(citizen_id);
CREATE INDEX IF NOT EXISTS idx_cvh_created_at ON citizen_verification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cvh_result ON citizen_verification_history(result);
