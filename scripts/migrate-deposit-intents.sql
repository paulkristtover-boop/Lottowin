-- Persist unique-amount deposit intents (survives bot restart)
CREATE TABLE IF NOT EXISTS deposit_intents (
  id              UUID PRIMARY KEY,
  user_id         BIGINT NOT NULL,
  network         TEXT NOT NULL,
  exact_amount    NUMERIC(18, 6) NOT NULL,
  base_amount     NUMERIC(18, 6) NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  tx_hash         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deposit_intents_pending
  ON deposit_intents (status, network, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_deposit_intents_user
  ON deposit_intents (user_id, status);
