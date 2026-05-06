/**
 * Tier resolution for the web surface.
 *
 * Reads `wallets.tier` and respects `tier_expires_at` so a premium SKU
 * automatically downgrades back to `paid` after its grant period ends.
 * The hourly Vercel Cron in /api/admin/reconcile-payai also normalizes the
 * column for any wallets whose expiry has lapsed.
 */
import type pg from "pg";

import type { Tier } from "@ares/engine";

export interface WalletTierInfo {
  tier: Tier;
  expiresAt: Date | null;
}

export async function getWalletTier(
  pool: pg.Pool,
  wallet: string,
): Promise<WalletTierInfo> {
  const r = await pool.query<{ tier: string; tier_expires_at: Date | null }>(
    `SELECT tier, tier_expires_at FROM wallets WHERE address = $1`,
    [wallet],
  );
  const row = r.rows[0];
  if (!row) return { tier: "free", expiresAt: null };

  const now = Date.now();
  const expiresAt = row.tier_expires_at ?? null;
  const tier = row.tier as Tier;

  if (tier === "premium" && expiresAt && expiresAt.getTime() < now) {
    return { tier: "paid", expiresAt };
  }
  return { tier, expiresAt };
}

export function isAtLeastTier(actual: Tier, required: Exclude<Tier, "anon">): boolean {
  const order: Record<Tier, number> = { anon: 0, free: 1, paid: 2, premium: 3 };
  return order[actual] >= order[required];
}
