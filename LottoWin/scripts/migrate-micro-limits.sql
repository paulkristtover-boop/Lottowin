-- Micro responsible-gaming defaults
ALTER TABLE users ALTER COLUMN daily_limit_usd TYPE NUMERIC(18, 8);
ALTER TABLE users ALTER COLUMN session_limit_usd TYPE NUMERIC(18, 8);

UPDATE users SET daily_limit_usd = 1
 WHERE daily_limit_usd IS NULL OR daily_limit_usd = 50;
UPDATE users SET session_limit_usd = 0.5
 WHERE session_limit_usd IS NULL OR session_limit_usd = 20;
