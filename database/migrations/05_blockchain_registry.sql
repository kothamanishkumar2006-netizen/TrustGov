-- Phase 5 Migration: Blockchain Registry & Integrity Anchoring
-- Stores metadata of anchored DIDs and Verifiable Credentials
-- CRITICAL SECURITY RULE: No private keys, mnemonics, or wallet secrets stored in this or any table.

CREATE TABLE IF NOT EXISTS blockchain_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id VARCHAR(255) REFERENCES verifiable_credentials(credential_id) ON DELETE CASCADE,
    officer_id UUID REFERENCES officers(id) ON DELETE CASCADE,
    officer_did VARCHAR(255) NOT NULL,
    credential_hash VARCHAR(66) NOT NULL UNIQUE,
    officer_did_hash VARCHAR(66) NOT NULL,
    issuer_did_hash VARCHAR(66) NOT NULL,
    blockchain_network VARCHAR(50) NOT NULL DEFAULT 'hardhat',
    chain_id INTEGER NOT NULL DEFAULT 31337,
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    registry_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    anchored_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain_did_registry (
    did VARCHAR(255) PRIMARY KEY,
    did_hash VARCHAR(66) NOT NULL UNIQUE,
    blockchain_network VARCHAR(50) NOT NULL DEFAULT 'hardhat',
    chain_id INTEGER NOT NULL DEFAULT 31337,
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_bcr_credential_id ON blockchain_registry(credential_id);
CREATE INDEX IF NOT EXISTS idx_bcr_officer_id ON blockchain_registry(officer_id);
CREATE INDEX IF NOT EXISTS idx_bcr_officer_did ON blockchain_registry(officer_did);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bcr_credential_hash ON blockchain_registry(credential_hash);
CREATE INDEX IF NOT EXISTS idx_bcr_tx_hash ON blockchain_registry(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_bcr_registry_status ON blockchain_registry(registry_status);
