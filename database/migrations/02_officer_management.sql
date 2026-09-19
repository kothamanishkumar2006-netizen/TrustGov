-- Phase 2 Migration: Government Officer Management
-- Safely extends the officers table without destroying existing Phase 1 data

-- 1. Ensure 'REVOKED' is a valid status enum value
DO $$
BEGIN
    ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'REVOKED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add full_name, official_email, official_phone columns to officers
ALTER TABLE officers ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE officers ADD COLUMN IF NOT EXISTS official_email VARCHAR(255);
ALTER TABLE officers ADD COLUMN IF NOT EXISTS official_phone VARCHAR(50);

-- 3. Backfill data for existing officers from users table
UPDATE officers o
SET 
    full_name = COALESCE(o.full_name, u.name),
    official_email = COALESCE(o.official_email, u.email),
    official_phone = COALESCE(o.official_phone, u.phone)
FROM users u
WHERE o.user_id = u.id AND (o.full_name IS NULL OR o.official_email IS NULL);

-- 4. Create performance indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_officers_department ON officers(department);
CREATE INDEX IF NOT EXISTS idx_officers_status ON officers(status);
CREATE INDEX IF NOT EXISTS idx_officers_full_name ON officers(full_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_officers_official_email ON officers(official_email);
