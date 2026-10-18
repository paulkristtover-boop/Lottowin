-- Daily Jackpot schema (run after base users/deposits tables exist, or standalone essentials)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id              BIGSERIAL PRIMARY KEY,
  telegram_id     BIGINT UNIQUE NOT NULL,
  username        TEXT,
  first_name      TEXT,
  last_name       TEXT,
  balance_usd     NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_deposited NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_wagered   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_won       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  referral_code   TEXT UNIQUE,
  referred_by     BIGINT,
  is_banned       BOOLEAN DEFAULT FALSE,
  free_lines      INT NOT NULL DEFAULT 0,
  year_of_birth   INT,
  age_verified_at TIMESTAMPTZ,
  captcha_passed_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  terms_version   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draws (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_date       DATE NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'open', -- open | closed | drawn | paid
  sales_close_at  TIMESTAMPTZ NOT NULL,
  drawn_at        TIMESTAMPTZ,
  winning_numbers INT[] ,
  pot_usd         NUMERIC(18, 6) NOT NULL DEFAULT 0,
  tickets_sold    INT NOT NULL DEFAULT 0,
  sales_usd       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  house_usd       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  rollover_in_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
  jackpot_paid_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
  winners_count   INT NOT NULL DEFAULT 0,
  rng_seed        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jackpot_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draw_id         UUID NOT NULL REFERENCES draws(id),
  user_id         BIGINT NOT NULL REFERENCES users(telegram_id),
  numbers         INT[] NOT NULL,
  cost_usd        NUMERIC(18, 6) NOT NULL DEFAULT 0,
  used_free       BOOLEAN NOT NULL DEFAULT FALSE,
  matches         INT,
  prize_usd       NUMERIC(18, 6) DEFAULT 0,
  free_line_won   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jackpot_lines_draw ON jackpot_lines(draw_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_lines_user ON jackpot_lines(user_id);

CREATE TABLE IF NOT EXISTS channel_posts (
  id          BIGSERIAL PRIMARY KEY,
  kind        TEXT NOT NULL,
  body        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- keep deposit_intents / withdrawals if already present from prior schema
