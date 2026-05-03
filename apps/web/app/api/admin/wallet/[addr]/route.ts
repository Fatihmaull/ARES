import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getBalanceUnits, ledgerHistory } from "@/lib/billing/ledger";
import { getPool } from "@/lib/db/pool";
import { isAdminWallet } from "@/lib/admin";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ addr: string }> },
): Promise<Response> {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session || !isAdminWallet(session.sub)) {
    return apiError(requestId, "FORBIDDEN", "Admin wallet session required.", 403);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const { addr } = await ctx.params;
  const wallet = decodeURIComponent(addr || "").trim();
  if (!wallet) {
    return apiError(requestId, "BAD_REQUEST", "Invalid wallet address.", 400);
  }

  const wr = await pool.query<{ tier: string; created_at: Date }>(
    `SELECT tier, created_at FROM wallets WHERE address = $1`,
    [wallet],
  );
  const row = wr.rows[0];

  const balanceUnits = await getBalanceUnits(pool, wallet);
  const history = await ledgerHistory(pool, wallet, 50);

  return apiSuccess(requestId, {
    wallet,
    exists: Boolean(row),
    tier: row?.tier ?? null,
    createdAt: row?.created_at?.toISOString() ?? null,
    balanceUnits,
    ledger: history.map((r) => ({
      id: r.id,
      direction: r.direction,
      units: Number.parseInt(r.units, 10),
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      relatedTxSig: r.related_tx_sig,
      relatedRunId: r.related_run_id,
    })),
  });
}
