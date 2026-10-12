-- Phase 8 Migration: Authorization Policies
-- Creates authorization_policies table for versioned TrustGov demo policies.
-- CRITICAL SECURITY RULE: Policies are declarative JSON/config; no executable code; versioned records.

CREATE TABLE IF NOT EXISTS authorization_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    department VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    action_code VARCHAR(100) NOT NULL,
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('ALLOW', 'DENY', 'REVIEW')),
    constraints JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    effective_to TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_policy_code_version UNIQUE (policy_code, version)
);

-- Indexes for performance and policy lookup
CREATE INDEX IF NOT EXISTS idx_auth_policies_lookup ON authorization_policies(department, role, action_code, status);
CREATE INDEX IF NOT EXISTS idx_auth_policies_code ON authorization_policies(policy_code);
CREATE INDEX IF NOT EXISTS idx_auth_policies_status ON authorization_policies(status);
CREATE INDEX IF NOT EXISTS idx_auth_policies_action ON authorization_policies(action_code);
