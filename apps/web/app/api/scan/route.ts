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
import { hasUnlimitedCredits } from "@/lib/billing/unlimited-credits";
import { consumeWalletFreeScan } from "@/lib/billing/quota";
import { getPool } from "@/lib/db/pool";
import { enqueueScanResponse } from "@/lib/scan/enqueue-scan";
import { enforceWalletRateLimit } from "@/lib/ratelimit/wallet";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId, operator } = ingress;

  const rate = enforceRateLimit(req, requestId, operator ? "op:scan" : "pub:scan", operator ? 60 : 10);
  if (!rate.ok) return rate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const target =
    typeof (body as { target?: unknown })?.target === "string"
      ? (body as { target: string }).target
      : ".";
  const model =
    typeof (body as { model?: unknown })?.model === "string"
      ? (body as { model: string }).model
      : undefined;

  const ip = getClientIp(req);
  const runId = crypto.randomUUID();

  // Operator: skip billing + quota, enqueue directly.
  if (operator) {
    return enqueueScanResponse({
      runId,
      requestId,
      target,
      model,
      wallet: null,
      provisionalDebitId: undefined,
      meta: { source: "api/scan", operator: true },
    });
  }

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(
      requestId,
      "FORBIDDEN",
      "Scans require a Solana wallet session. Anonymous preview is chat-only.",
      403,
    );
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
    return apiError(
      requestId,
      "INTERNAL_ERROR",
      "DATABASE_URL is required for wallet-based scans.",
      503,
    );
  }

  const wallet = session.sub;

  if (hasUnlimitedCredits(wallet)) {
    return enqueueScanResponse({
      runId,
      requestId,
      target,
      model,
      wallet,
      provisionalDebitId: undefined,
      meta: { source: "api/scan", unlimitedCredits: true },
    });
  }

  const balance = await getBalanceUnits(pool, wallet);

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
      return enqueueScanResponse({
        runId,
        requestId,
        target,
        model,
        wallet,
        provisionalDebitId: debitId,
      });
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

  return enqueueScanResponse({
    runId,
    requestId,
    target,
    model,
    wallet,
    provisionalDebitId: undefined,
  });
}
