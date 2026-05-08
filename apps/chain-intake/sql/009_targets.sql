-- Per-wallet monitored assets (programs, contracts, repos, domains).
-- Apply after 008_wallet_tier_expiry.sql (or any migration after wallets exist).

CREATE TABLE IF NOT EXISTS targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL REFERENCES wallets (address) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (
    kind IN ('solana_program', 'evm_contract', 'github_repo', 'domain', 'wallet')
  ),
  identifier TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_scanned_at TIMESTAMPTZ,
  last_run_id TEXT REFERENCES runs (id) ON DELETE SET NULL,
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS targets_wallet_archived_created_idx
  ON targets (wallet, archived_at NULLS FIRST, created_at DESC);

CREATE INDEX IF NOT EXISTS targets_wallet_identifier_uidx
  ON targets (wallet, kind, identifier)
  WHERE archived_at IS NULL;
