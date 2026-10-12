-- ============================================================
-- TRUSTGOV - PHASE 9: REPORT EVIDENCE & REVIEW NOTES TABLES
-- Migration 09: Supporting Evidence & Admin Review Notes
-- ============================================================

CREATE TABLE IF NOT EXISTS report_evidence (
    id VARCHAR(64) PRIMARY KEY,
    evidence_id VARCHAR(32) UNIQUE NOT NULL,
    report_id VARCHAR(64) NOT NULL REFERENCES scam_reports(id) ON DELETE CASCADE,
    evidence_type VARCHAR(32) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    storage_reference VARCHAR(255) NOT NULL,
    description TEXT,
    uploaded_by VARCHAR(64) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Report Evidence Indexes
CREATE INDEX IF NOT EXISTS idx_report_evidence_evidence_id ON report_evidence(evidence_id);
CREATE INDEX IF NOT EXISTS idx_report_evidence_report_id ON report_evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_report_evidence_sha256 ON report_evidence(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_report_evidence_uploaded_at ON report_evidence(uploaded_at DESC);

CREATE TABLE IF NOT EXISTS report_review_notes (
    id VARCHAR(64) PRIMARY KEY,
    report_id VARCHAR(64) NOT NULL REFERENCES scam_reports(id) ON DELETE CASCADE,
    note_id VARCHAR(32) UNIQUE NOT NULL,
    reviewer_id VARCHAR(64) NOT NULL,
    reviewer_name VARCHAR(255),
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Review Notes Indexes
CREATE INDEX IF NOT EXISTS idx_report_review_notes_report_id ON report_review_notes(report_id);
CREATE INDEX IF NOT EXISTS idx_report_review_notes_reviewer_id ON report_review_notes(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_report_review_notes_created_at ON report_review_notes(created_at ASC);
