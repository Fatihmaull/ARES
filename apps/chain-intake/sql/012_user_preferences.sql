CREATE TABLE IF NOT EXISTS user_preferences (
  wallet TEXT PRIMARY KEY REFERENCES wallets (address) ON DELETE CASCADE,
  display_name TEXT,
  default_model TEXT,
  default_target_kind TEXT CHECK (
    default_target_kind IS NULL OR default_target_kind IN (
      'solana_program', 'evm_contract', 'github_repo', 'domain', 'wallet'
    )
  ),
  theme_pref TEXT CHECK (theme_pref IS NULL OR theme_pref IN ('dark', 'light')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
