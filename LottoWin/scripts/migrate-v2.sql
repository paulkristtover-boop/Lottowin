-- Run if upgrading from v1 schema
ALTER TABLE users ADD COLUMN IF NOT EXISTS year_of_birth INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS captcha_passed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS prize_before_cap NUMERIC(18,6) DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS liability_capped BOOLEAN DEFAULT FALSE;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rng_seed TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rng_source TEXT DEFAULT 'auto';

-- New tables created by full schema.sql — safe to re-run CREATE IF NOT EXISTS
