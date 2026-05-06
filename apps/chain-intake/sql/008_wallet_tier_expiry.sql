-- Premium SKU grants `tier='premium'` for a bounded duration. We need an expiry column
-- so the policy engine can downgrade users back to `paid` when premium lapses.
-- Apply after 007_pricing_catalog.sql.

DO $$
BEGIN
  ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_tier_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE wallets
  ADD CONSTRAINT wallets_tier_check
    CHECK (tier IN ('free', 'paid', 'premium'));

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS wallets_tier_expires_idx
  ON wallets (tier_expires_at)
  WHERE tier_expires_at IS NOT NULL;
