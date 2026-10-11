ALTER TABLE users ADD COLUMN IF NOT EXISTS last_banner_week TEXT;

INSERT INTO settings (key, value, updated_at)
VALUES ('weekly_banner_enabled', 'true'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
