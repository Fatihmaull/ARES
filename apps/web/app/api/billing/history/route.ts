import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { ledgerHistory } from "@/lib/billing/ledger";
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

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw || "40", 10) || 40));

  const rows = await ledgerHistory(pool, session.sub, limit);

  return apiSuccess(requestId, {
    wallet: session.sub,
    entries: rows.map((r) => ({
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
