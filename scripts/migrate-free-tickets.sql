-- Free ticket credits (replaces cash welcome/referral bonuses)
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_tickets INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unlocked_tickets INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_deposit_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_tickets_granted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_tickets_claimed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_real_bet_at TIMESTAMPTZ;

-- Track ticket credit movements
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

-- Rolling daily player spend (cash only; free tickets don't count toward $50)
CREATE TABLE IF NOT EXISTS daily_spend (
  user_id         BIGINT NOT NULL,
  period_date     DATE NOT NULL,
  spent_usd       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_date)
);
