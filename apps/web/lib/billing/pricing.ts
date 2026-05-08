/**
 * Keep bundle IDs + units aligned with apps/chain-intake/src/bundle-units.ts
 */
export type TopUpBundle = {
  id: string;
  label: string;
  usdc: number;
  units: number;
};

export const TOPUP_BUNDLES: readonly TopUpBundle[] = [
  { id: "starter", label: "100 units", usdc: 1, units: 100 },
  { id: "growth", label: "1,100 units (10% bonus)", usdc: 10, units: 1100 },
];

export const ACTION_COST_UNITS = {
  chat: 1,
  scan: 10,
  report: 2,
} as const;

/** Anonymous preview (draft §2). */
export const ANON_CHAT_PER_DAY = 1;

/** Wallet free tier (draft §2 + decisions). */
export const WALLET_FREE_CHAT_PER_DAY = 10;
export const WALLET_FREE_SCANS_PER_MONTH = 2;
