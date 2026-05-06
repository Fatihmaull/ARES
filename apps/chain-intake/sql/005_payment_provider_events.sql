-- Append-only audit of webhook deliveries from payment providers (PayAI today).
-- Apply after 004_purchases.sql.

CREATE TABLE IF NOT EXISTS payment_provider_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'payai',
  idempotency_key TEXT NOT NULL,
  raw JSONB NOT NULL,
  verified BOOLEAN NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('CREDITED', 'IGNORED', 'REJECTED', 'PENDING')),
  related_purchase_id UUID REFERENCES purchases (id),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_events_provider_key_uidx
  ON payment_provider_events (provider, idempotency_key);

CREATE INDEX IF NOT EXISTS payment_provider_events_purchase_idx
  ON payment_provider_events (related_purchase_id);
