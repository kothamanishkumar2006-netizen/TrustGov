-- Phase 6 Migration: Officer Proof-of-Possession & Challenge-Response
-- Creates the verification_challenges table for single-use, time-bound cryptographic challenges
-- CRITICAL SECURITY RULE: No private keys, mnemonics, or signatures stored in this or any database table.

CREATE TABLE IF NOT EXISTS verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id VARCHAR(255) UNIQUE NOT NULL,
    officer_id UUID NOT NULL REFERENCES officers(id) ON DELETE CASCADE,
    officer_did VARCHAR(255) NOT NULL,
    nonce TEXT NOT NULL,
    audience VARCHAR(255) NOT NULL DEFAULT 'trustgov-citizen-verifier',
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance and lookup indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_challenge_id ON verification_challenges(challenge_id);
CREATE INDEX IF NOT EXISTS idx_vc_officer_id ON verification_challenges(officer_id);
CREATE INDEX IF NOT EXISTS idx_vc_officer_did ON verification_challenges(officer_did);
CREATE INDEX IF NOT EXISTS idx_vc_status ON verification_challenges(status);
CREATE INDEX IF NOT EXISTS idx_vc_expires_at ON verification_challenges(expires_at);
