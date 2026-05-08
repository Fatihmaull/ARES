CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  wallet TEXT NOT NULL REFERENCES wallets (address) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  related_run_id TEXT REFERENCES runs (id) ON DELETE SET NULL,
  related_purchase_id UUID REFERENCES purchases (id) ON DELETE SET NULL,
  related_finding_id BIGINT REFERENCES findings (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_wallet_created_idx
  ON notifications (wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_wallet_unread_idx
  ON notifications (wallet, read_at NULLS FIRST);
