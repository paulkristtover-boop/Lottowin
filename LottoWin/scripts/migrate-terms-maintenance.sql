ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;

INSERT INTO settings (key, value, updated_at)
VALUES ('maintenance_mode', 'false', NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value, updated_at)
VALUES ('maintenance_message', '', NOW())
ON CONFLICT (key) DO NOTHING;
