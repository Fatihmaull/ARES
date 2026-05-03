import { getWalletMinuteLimiter, retryAfterSeconds } from "./shared";

export type WalletRateOutcome =
  | { ok: true }
  | { ok: false; retrySec: number };

export async function enforceWalletRateLimit(wallet: string): Promise<WalletRateOutcome> {
  const lim = getWalletMinuteLimiter();
  if (!lim) return { ok: true };

  const { success, reset } = await lim.limit(wallet);
  if (success) return { ok: true };

  return { ok: false, retrySec: retryAfterSeconds(reset) };
}
