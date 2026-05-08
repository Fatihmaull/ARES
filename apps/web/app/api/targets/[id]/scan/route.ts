import {
  apiError,
  apiSuccess,
  authenticateIngress,
  enforceRateLimit,
  getClientIp,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import {
  insertDebitPending,
  refundDebit,
  getBalanceUnits,
} from "@/lib/billing/ledger";
import { ACTION_COST_UNITS } from "@/lib/billing/pricing";
import { consumeWalletFreeScan } from "@/lib/billing/quota";
import { getPool } from "@/lib/db/pool";
import { enqueueScanResponse } from "@/lib/scan/enqueue-scan";
import { getTarget, scanTargetFromRow, touchTargetScan } from "@/lib/targets/store";
import { enforceWalletRateLimit } from "@/lib/ratelimit/wallet";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId, operator } = ingress;

  const rate = enforceRateLimit(req, requestId, operator ? "op:target-scan" : "pub:target-scan", operator ? 60 : 10);
  if (!rate.ok) return rate.response;

  const { id: targetId } = await ctx.params;
  const ip = getClientIp(req);
  const runId = crypto.randomUUID();

  if (operator) {
    return apiError(requestId, "BAD_REQUEST", "Use /api/scan for operator scans.", 400);
  }

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const wl = await enforceWalletRateLimit(session.sub);
  if (!wl.ok) {
    return apiError(
      requestId,
      "RATE_LIMITED",
      `Wallet rate limit exceeded. Retry after ${wl.retrySec}s.`,
      429,
    );
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const row = await getTarget({ pool, wallet: session.sub, id: targetId });
  if (!row || row.archived_at) {
    return apiError(requestId, "NOT_FOUND", "Target not found.", 404);
  }

  const target = scanTargetFromRow(row);
  const wallet = session.sub;
  const balance = await getBalanceUnits(pool, wallet);

  const meta = { source: "api/targets/[id]/scan", targetId: row.id };

  if (balance >= ACTION_COST_UNITS.scan) {
    let debitId: number | undefined;
    try {
      debitId = await insertDebitPending({
        pool,
        wallet,
        units: ACTION_COST_UNITS.scan,
        reason: "scan",
        relatedRunId: runId,
      });
      const res = await enqueueScanResponse({
        runId,
        requestId,
        target,
        wallet,
        provisionalDebitId: debitId,
        meta,
      });
      if (res.status >= 200 && res.status < 300) {
        await touchTargetScan({ pool, wallet, targetId: row.id, runId });
      }
      return res;
    } catch (err) {
      if (debitId !== undefined) await refundDebit(pool, debitId);
      throw err;
    }
  }

  const okQuota = await consumeWalletFreeScan(pool, wallet, ip);
  if (!okQuota) {
    return apiError(
      requestId,
      "RATE_LIMITED",
      "Free-tier scan quota exceeded. Top up credits or wait until next month.",
      429,
    );
  }

  const res = await enqueueScanResponse({
    runId,
    requestId,
    target,
    wallet,
    provisionalDebitId: undefined,
    meta,
  });
  if (res.status >= 200 && res.status < 300) {
    await touchTargetScan({ pool, wallet, targetId: row.id, runId });
  }
  return res;
}
