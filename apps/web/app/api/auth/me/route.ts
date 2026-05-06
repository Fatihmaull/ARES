import { apiSuccess, getRequestId } from "@/lib/api";
import { isAdminWallet } from "@/lib/admin";
import { readWalletSession } from "@/lib/auth/read-session";
import { getBalanceUnits } from "@/lib/billing/ledger";
import { getPool } from "@/lib/db/pool";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session) {
    return apiSuccess(requestId, { authenticated: false as const });
  }

  const pool = getPool();
  let balanceUnits = 0;
  if (pool) {
    balanceUnits = await getBalanceUnits(pool, session.sub);
  }

  const tier: "free" | "paid" = balanceUnits > 0 ? "paid" : "free";

  return apiSuccess(requestId, {
    authenticated: true as const,
    wallet: session.sub,
    tier,
    balanceUnits,
    isAdmin: isAdminWallet(session.sub),
  });
}
