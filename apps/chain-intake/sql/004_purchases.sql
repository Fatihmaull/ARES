-- Purchases: pending and settled top-ups initiated through PayAI (or any cash-in rail).
-- Apply after 003_billing.sql.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES wallets (address),
  sku_id TEXT NOT NULL,
  amount_usdc NUMERIC(20, 6) NOT NULL CHECK (amount_usdc >= 0),
  units_expected BIGINT NOT NULL CHECK (units_expected > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'SETTLED', 'CANCELED', 'FAILED')),
  provider TEXT NOT NULL DEFAULT 'payai',
  payai_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS purchases_payai_payment_id_uidx
  ON purchases (payai_payment_id)
  WHERE payai_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS purchases_wallet_created_idx
  ON purchases (wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS purchases_status_idx
  ON purchases (status, expires_at);
