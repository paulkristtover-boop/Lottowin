-- LottoWin Instant 4/40 Schema (v2)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  language_code   TEXT DEFAULT 'en',
  balance_usd     NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_wagered   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_won       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  referral_code   TEXT UNIQUE,
  public_id       TEXT UNIQUE,
  referred_by     BIGINT,
  welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
  locked_tickets INT NOT NULL DEFAULT 0,
  unlocked_tickets INT NOT NULL DEFAULT 0,
  is_first_deposit_completed BOOLEAN NOT NULL DEFAULT FALSE,
  welcome_tickets_granted BOOLEAN NOT NULL DEFAULT FALSE,
  referral_tickets_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  first_real_bet_at TIMESTAMPTZ,
  is_banned       BOOLEAN DEFAULT FALSE,
  ban_reason      TEXT,
  daily_limit_usd NUMERIC(18, 8) DEFAULT 1,
  session_limit_usd NUMERIC(18, 8) DEFAULT 0.5,
  self_excluded_until TIMESTAMPTZ,
  -- Age & CAPTCHA gates
  year_of_birth   INT,
  age_verified_at TIMESTAMPTZ,
  captcha_passed_at TIMESTAMPTZ,
  -- Anti-abuse signals (Telegram does not expose client IP; we store what we can)
  last_user_agent TEXT,
  device_fingerprint TEXT,
  risk_score      INT DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Tickets / plays
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  game            TEXT DEFAULT '4_40',
  lines           JSONB NOT NULL,
  cost_usd        NUMERIC(18, 6) NOT NULL,
  total_prize_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
  prize_before_cap NUMERIC(18, 6) DEFAULT 0,
  liability_capped BOOLEAN DEFAULT FALSE,
  winning_numbers INTEGER[] NOT NULL,
  rng_seed        TEXT,
  rng_source      TEXT DEFAULT 'auto',  -- auto | manual_override
  status          TEXT NOT NULL DEFAULT 'completed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);

-- Deposits
CREATE TABLE IF NOT EXISTS deposits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL DEFAULT 0,
  chain           TEXT NOT NULL,
  tx_hash         TEXT UNIQUE,
  amount_crypto   NUMERIC(36, 18) NOT NULL,
  amount_usd      NUMERIC(18, 6) NOT NULL,
  rate_usd        NUMERIC(18, 8),
  status          TEXT NOT NULL DEFAULT 'pending',
  confirmations   INT DEFAULT 0,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  memo_or_tag     TEXT,
  raw_data        JSONB
);

CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);
CREATE INDEX IF NOT EXISTS idx_deposits_tx ON deposits(tx_hash);

-- Withdrawals
CREATE TABLE IF NOT EXISTS withdrawals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  chain           TEXT NOT NULL,
  address         TEXT NOT NULL,
  amount_usd      NUMERIC(18, 6) NOT NULL,
  amount_crypto   NUMERIC(36, 18),
  rate_usd        NUMERIC(18, 8),
  fee_usd         NUMERIC(18, 6) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  tx_hash         TEXT,
  admin_note      TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- Transactions ledger
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  type            TEXT NOT NULL,
  amount_usd      NUMERIC(18, 6) NOT NULL,
  balance_after   NUMERIC(18, 6) NOT NULL,
  reference_id    UUID,
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- Referral rewards
CREATE TABLE IF NOT EXISTS referral_rewards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id     BIGINT NOT NULL REFERENCES users(telegram_id),
  referred_id     BIGINT NOT NULL REFERENCES users(telegram_id),
  amount_usd      NUMERIC(18, 6) NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        BIGINT,
  actor_type      TEXT NOT NULL DEFAULT 'user',
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  details         JSONB,
  ip              TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  subject         TEXT,
  message         TEXT NOT NULL,
  status          TEXT DEFAULT 'open',
  admin_reply     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fraud flags
CREATE TABLE IF NOT EXISTS fraud_flags (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  reason          TEXT NOT NULL,
  severity        TEXT DEFAULT 'medium',
  resolved        BOOLEAN DEFAULT FALSE,
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_user ON fraud_flags(user_id);

-- User deposit addresses
CREATE TABLE IF NOT EXISTS user_deposit_addresses (
  id              SERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  chain           TEXT NOT NULL,
  address         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, chain)
);

-- Play sessions
CREATE TABLE IF NOT EXISTS play_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wagered_usd     NUMERIC(18, 6) DEFAULT 0,
  ended_at        TIMESTAMPTZ
);

-- Tax ledger (gaming tax on GGR)
CREATE TABLE IF NOT EXISTS tax_ledger (
  id              BIGSERIAL PRIMARY KEY,
  period_date     DATE NOT NULL,              -- UTC day
  gross_wagered   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  gross_prizes    NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ggr             NUMERIC(18, 6) NOT NULL DEFAULT 0,  -- wagered - prizes
  tax_rate        NUMERIC(8, 4) NOT NULL,
  tax_amount      NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ticket_count    INT DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_date)
);

-- RNG audit / manual overrides
CREATE TABLE IF NOT EXISTS rng_events (
  id              BIGSERIAL PRIMARY KEY,
  ticket_id       UUID,
  source          TEXT NOT NULL,             -- auto | manual
  seed            TEXT,
  numbers         INTEGER[] NOT NULL,
  admin_id        BIGINT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Broadcast / push jobs
CREATE TABLE IF NOT EXISTS broadcasts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           TEXT,
  message         TEXT NOT NULL,
  audience        TEXT DEFAULT 'all',        -- all | active | depositors
  status          TEXT DEFAULT 'pending',    -- pending | sending | done | failed
  sent_count      INT DEFAULT 0,
  fail_count      INT DEFAULT 0,
  created_by      BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Daily liability tracker
CREATE TABLE IF NOT EXISTS daily_liability (
  period_date     DATE PRIMARY KEY,
  prizes_paid     NUMERIC(18, 6) NOT NULL DEFAULT 0,
  tickets         INT DEFAULT 0,
  capped_count    INT DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collusion / ring signals
CREATE TABLE IF NOT EXISTS collusion_signals (
  id              BIGSERIAL PRIMARY KEY,
  user_ids        BIGINT[] NOT NULL,
  signal_type     TEXT NOT NULL,             -- referral_ring | same_pattern | rapid_multi
  score           INT DEFAULT 0,
  details         JSONB,
  resolved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Ticket credit ledger
CREATE TABLE IF NOT EXISTS ticket_credits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  delta_locked    INT NOT NULL DEFAULT 0,
  delta_unlocked  INT NOT NULL DEFAULT 0,
  reason          TEXT NOT NULL,
  meta            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_credits_user ON ticket_credits(user_id);

CREATE TABLE IF NOT EXISTS daily_spend (
  user_id         BIGINT NOT NULL,
  period_date     DATE NOT NULL,
  spent_usd       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_date)
);


-- Contests
CREATE TABLE IF NOT EXISTS contest_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind          TEXT NOT NULL,
  period_key    TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  pool_usd      NUMERIC(18, 6) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open',
  settled_at    TIMESTAMPTZ,
  UNIQUE (kind, period_key)
);
CREATE TABLE IF NOT EXISTS contest_payouts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id     UUID NOT NULL REFERENCES contest_periods(id),
  user_id       BIGINT NOT NULL,
  rank          INT NOT NULL,
  volume_usd    NUMERIC(18, 6) NOT NULL DEFAULT 0,
  prize_usd     NUMERIC(18, 6) NOT NULL DEFAULT 0,
  credited      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_joined_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_last_remind_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_remind_count INT NOT NULL DEFAULT 0;
