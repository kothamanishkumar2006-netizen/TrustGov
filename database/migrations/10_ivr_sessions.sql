-- ============================================================
-- TRUSTGOV - PHASE 10: IVR ACCESSIBILITY & PHONE VERIFICATION
-- Migration 10: IVR Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS ivr_sessions (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) UNIQUE NOT NULL,
    state VARCHAR(32) NOT NULL DEFAULT 'WELCOME',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    caller_reference VARCHAR(64),
    officer_reference VARCHAR(128),
    verification_reference VARCHAR(64),
    authorization_reference VARCHAR(64),
    report_reference VARCHAR(64),
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_session_id ON ivr_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_status ON ivr_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_expires_at ON ivr_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_verification_ref ON ivr_sessions(verification_reference);
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_caller_ref ON ivr_sessions(caller_reference);
CREATE INDEX IF NOT EXISTS idx_ivr_sessions_created_at ON ivr_sessions(created_at DESC);
