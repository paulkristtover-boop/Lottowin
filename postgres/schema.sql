-- LottoWin Instant 4/40 Schema

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
  referred_by     BIGINT REFERENCES users(telegram_id),
  welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
  is_banned       BOOLEAN DEFAULT FALSE,
  ban_reason      TEXT,
  daily_limit_usd NUMERIC(18, 2) DEFAULT 50,
  session_limit_usd NUMERIC(18, 2) DEFAULT 20,
  self_excluded_until TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);

-- Tickets / plays
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  lines           JSONB NOT NULL,          -- array of {numbers: [1,2,3,4], matches: N, prize: X}
  cost_usd        NUMERIC(18, 6) NOT NULL,
  total_prize_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
  winning_numbers INTEGER[] NOT NULL,     -- the 4 drawn numbers
  status          TEXT NOT NULL DEFAULT 'completed', -- completed | refunded
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);

-- Deposits
CREATE TABLE IF NOT EXISTS deposits (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  chain           TEXT NOT NULL,           -- trc20 | erc20 | btc | eth | trx
  tx_hash         TEXT UNIQUE,
  amount_crypto   NUMERIC(36, 18) NOT NULL,
  amount_usd      NUMERIC(18, 6) NOT NULL,
  rate_usd        NUMERIC(18, 8),
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | failed
  confirmations   INT DEFAULT 0,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ,
  memo_or_tag     TEXT,                    -- for identifying user (optional)
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
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | approved | processing | completed | rejected
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
  type            TEXT NOT NULL, -- deposit | withdraw | play | win | bonus | referral | adjustment
  amount_usd      NUMERIC(18, 6) NOT NULL,
  balance_after   NUMERIC(18, 6) NOT NULL,
  reference_id    UUID,                    -- ticket/deposit/withdrawal id
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
  reason          TEXT,                    -- signup | first_deposit | play_percent
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        BIGINT,                  -- telegram_id or 0 for system
  actor_type      TEXT NOT NULL DEFAULT 'user', -- user | admin | system
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  details         JSONB,
  ip              TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- Settings (key-value)
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
  status          TEXT DEFAULT 'open', -- open | replied | closed
  admin_reply     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fraud flags
CREATE TABLE IF NOT EXISTS fraud_flags (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  reason          TEXT NOT NULL,
  severity        TEXT DEFAULT 'medium', -- low | medium | high
  resolved        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deposit addresses assigned to users (optional for memo-less chains)
CREATE TABLE IF NOT EXISTS user_deposit_addresses (
  id              SERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  chain           TEXT NOT NULL,
  address         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, chain)
);

-- Session play tracking for responsible gaming
CREATE TABLE IF NOT EXISTS play_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  wagered_usd     NUMERIC(18, 6) DEFAULT 0,
  ended_at        TIMESTAMPTZ
);
