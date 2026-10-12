-- Phase 4 Migration: Verifiable Credentials (VC)
-- Creates the verifiable_credentials table and associated integrity and performance indexes
-- CRITICAL SECURITY RULE: No private keys or sensitive credentials stored in this or any table.

CREATE TABLE IF NOT EXISTS verifiable_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id VARCHAR(255) UNIQUE NOT NULL,
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    officer_did VARCHAR(255) NOT NULL,
    issuer_did VARCHAR(255) NOT NULL,
    credential_type VARCHAR(100) NOT NULL DEFAULT 'GovernmentOfficerCredential',
    credential_subject JSONB NOT NULL,
    credential_payload JSONB NOT NULL,
    proof JSONB NOT NULL,
    status credential_status NOT NULL DEFAULT 'ACTIVE',
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance and uniqueness indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_credential_id ON verifiable_credentials(credential_id);
CREATE INDEX IF NOT EXISTS idx_vc_officer_id ON verifiable_credentials(officer_id);
CREATE INDEX IF NOT EXISTS idx_vc_officer_did ON verifiable_credentials(officer_did);
CREATE INDEX IF NOT EXISTS idx_vc_issuer_did ON verifiable_credentials(issuer_did);
CREATE INDEX IF NOT EXISTS idx_vc_status ON verifiable_credentials(status);

-- Partial unique index ensuring at most one active GovernmentOfficerCredential per officer
CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_one_active_per_officer 
ON verifiable_credentials (officer_id) 
WHERE (status = 'ACTIVE');
