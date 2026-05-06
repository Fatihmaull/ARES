import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getBalanceUnits } from "@/lib/billing/ledger";
import { getWalletTier } from "@/lib/billing/tier";
import { getPool } from "@/lib/db/pool";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "UNAUTHORIZED", "Wallet session required.", 401);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const [balanceUnits, tierInfo] = await Promise.all([
    getBalanceUnits(pool, session.sub),
    getWalletTier(pool, session.sub),
  ]);

  return apiSuccess(requestId, {
    wallet: session.sub,
    tier: tierInfo.tier,
    tierExpiresAt: tierInfo.expiresAt?.toISOString() ?? null,
    units: balanceUnits,
  });
}
