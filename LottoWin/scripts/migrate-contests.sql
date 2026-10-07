-- Daily wager contest + weekly referral battle
CREATE TABLE IF NOT EXISTS contest_periods (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind          TEXT NOT NULL,           -- daily_wager | weekly_referral
  period_key    TEXT NOT NULL,           -- YYYY-MM-DD or YYYY-Www
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  pool_usd      NUMERIC(18, 6) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'open', -- open | settled
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

CREATE INDEX IF NOT EXISTS idx_contest_payouts_user ON contest_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_periods_kind ON contest_periods(kind, period_key);
