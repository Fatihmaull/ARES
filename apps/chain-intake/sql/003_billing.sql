-- Billing: wallets, ledger, quotas (shared with apps/web). Apply after 002_triggers.sql.

CREATE TABLE IF NOT EXISTS wallets (
  address TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES wallets (address),
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  units BIGINT NOT NULL CHECK (units > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SETTLED', 'REFUNDED')),
  related_tx_sig TEXT,
  related_run_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

-- Duplicate deposit tx signatures ignored (PostgreSQL UNIQUE treats NULL as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS credits_ledger_related_tx_sig_uidx
  ON credits_ledger (related_tx_sig);

CREATE INDEX IF NOT EXISTS credits_ledger_wallet_created_idx
  ON credits_ledger (wallet, created_at DESC);

CREATE TABLE IF NOT EXISTS quota_counters (
  wallet TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  window_kind TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (wallet, ip, window_kind, window_start)
);

CREATE INDEX IF NOT EXISTS quota_counters_kind_start_idx
  ON quota_counters (window_kind, window_start);

-- Derived balance view (settled credits minus settled debits).
CREATE OR REPLACE VIEW wallet_balance AS
SELECT
  w.address AS wallet,
  COALESCE(SUM(
    CASE
      WHEN l.direction = 'CREDIT' AND l.status = 'SETTLED' THEN l.units
      WHEN l.direction = 'DEBIT' AND l.status = 'SETTLED' THEN -l.units
      ELSE 0
    END
  ), 0)::BIGINT AS units_balance
FROM wallets w
LEFT JOIN credits_ledger l ON l.wallet = w.address
GROUP BY w.address;
