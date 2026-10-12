-- Phase 8 Migration: Authorization Evaluation History
-- Creates authorization_evaluations table for recording safe, non-sensitive audit references of authorization evaluations.
-- CRITICAL SECURITY RULE: No passwords, OTPs, PINs, bank accounts, full UPI IDs, private keys, or raw confidential credentials stored.

CREATE TABLE IF NOT EXISTS authorization_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id VARCHAR(50) UNIQUE NOT NULL,
    citizen_id UUID REFERENCES users(id) ON DELETE CASCADE,
    officer_reference VARCHAR(255) NOT NULL,
    officer_name VARCHAR(255),
    department VARCHAR(255),
    credential_reference VARCHAR(255),
    action_code VARCHAR(100) NOT NULL,
    policy_code VARCHAR(100),
    policy_version INT,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'REVIEW')),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    checks_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_historical BOOLEAN NOT NULL DEFAULT false,
    evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance and privacy lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_eval_id ON authorization_evaluations(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_auth_eval_citizen_id ON authorization_evaluations(citizen_id);
CREATE INDEX IF NOT EXISTS idx_auth_eval_officer_ref ON authorization_evaluations(officer_reference);
CREATE INDEX IF NOT EXISTS idx_auth_eval_created_at ON authorization_evaluations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_eval_decision ON authorization_evaluations(decision);
