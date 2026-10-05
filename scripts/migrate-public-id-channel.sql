ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_joined_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_last_remind_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_remind_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);

-- Backfill public_id from referral_code style for existing rows
UPDATE users SET public_id = 'LW' || upper(substr(md5(telegram_id::text || coalesce(referral_code,'')), 1, 6))
WHERE public_id IS NULL;
