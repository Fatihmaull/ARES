import { getIpMinuteLimiter, retryAfterSeconds } from "./shared";

export type IpRateOutcome =
  | { ok: true }
  | { ok: false; retrySec: number };

export async function enforceIpRateLimit(ip: string): Promise<IpRateOutcome> {
  const lim = getIpMinuteLimiter();
  if (!lim) return { ok: true };

  const { success, reset } = await lim.limit(ip);
  if (success) return { ok: true };

  return { ok: false, retrySec: retryAfterSeconds(reset) };
}
