-- ============================================================
-- TRUSTGOV - PHASE 9: SCAM REPORTS TABLE
-- Migration 09: Scam and Suspicious Interaction Reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS scam_reports (
    id VARCHAR(64) PRIMARY KEY,
    report_id VARCHAR(32) UNIQUE NOT NULL,
    citizen_id VARCHAR(64) NOT NULL,
    officer_reference VARCHAR(128),
    officer_name VARCHAR(255),
    department VARCHAR(100),
    verification_reference VARCHAR(64),
    authorization_evaluation_reference VARCHAR(64),
    report_category VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    reported_action_code VARCHAR(64),
    risk_level VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Performance and query lookup indexes
CREATE INDEX IF NOT EXISTS idx_scam_reports_report_id ON scam_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_scam_reports_citizen_id ON scam_reports(citizen_id);
CREATE INDEX IF NOT EXISTS idx_scam_reports_officer_reference ON scam_reports(officer_reference);
CREATE INDEX IF NOT EXISTS idx_scam_reports_status ON scam_reports(status);
CREATE INDEX IF NOT EXISTS idx_scam_reports_category ON scam_reports(report_category);
CREATE INDEX IF NOT EXISTS idx_scam_reports_verification_ref ON scam_reports(verification_reference);
CREATE INDEX IF NOT EXISTS idx_scam_reports_auth_ref ON scam_reports(authorization_evaluation_reference);
CREATE INDEX IF NOT EXISTS idx_scam_reports_submitted_at ON scam_reports(submitted_at DESC);
