-- Phase 3 Migration: DID & Cryptographic Identity
-- Creates the did_identities table and associated performance and integrity constraints
-- CRITICAL SECURITY RULE: No private keys are stored in this or any database table.

CREATE TABLE IF NOT EXISTS did_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    did VARCHAR(255) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    key_type VARCHAR(50) NOT NULL DEFAULT 'Ed25519',
    status user_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_officer_did UNIQUE (officer_id)
);

-- Performance and uniqueness indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_did_identities_did ON did_identities(did);
CREATE UNIQUE INDEX IF NOT EXISTS idx_did_identities_officer ON did_identities(officer_id);
CREATE INDEX IF NOT EXISTS idx_did_identities_status ON did_identities(status);
