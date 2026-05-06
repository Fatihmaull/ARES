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
import { createRun } from "@/lib/billing/runs";
import { getPool } from "@/lib/db/pool";
import { getQueueClient } from "@/lib/queue/client";
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
    return enqueueScan({
      runId,
      requestId,
      target,
      model,
      wallet: null,
      provisionalDebitId: undefined,
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
      return await enqueueScan({
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

  return enqueueScan({
    runId,
    requestId,
    target,
    model,
    wallet,
    provisionalDebitId: undefined,
  });
}

interface EnqueueScanInput {
  runId: string;
  requestId: string;
  target: string;
  model?: string;
  wallet: string | null;
  provisionalDebitId?: number;
}

async function enqueueScan(input: EnqueueScanInput): Promise<Response> {
  const pool = getPool();
  if (pool) {
    await createRun({
      pool,
      id: input.runId,
      wallet: input.wallet,
      kind: "scan",
      target: input.target,
      model: input.model ?? null,
      requestId: input.requestId,
      relatedDebitId: input.provisionalDebitId ?? null,
      meta: { source: "api/scan" },
    });
  }

  try {
    const queue = await getQueueClient();
    const result = await queue.enqueue(
      {
        kind: "scan-full",
        runId: input.runId,
        requestId: input.requestId,
        wallet: input.wallet,
        target: input.target,
        model: input.model,
        provisionalDebitId: input.provisionalDebitId,
      },
      { jobId: input.runId },
    );
    return apiSuccess(input.requestId, {
      status: "queued",
      runId: input.runId,
      jobId: result.jobId,
      inline: result.inline,
      target: input.target,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    // Refund the provisional debit if we couldn't enqueue.
    if (pool && input.provisionalDebitId !== undefined) {
      await refundDebit(pool, input.provisionalDebitId).catch(() => {});
    }
    const msg = error instanceof Error ? error.message : String(error);
    return apiError(
      input.requestId,
      "INTERNAL_ERROR",
      "Failed to enqueue scan job.",
      500,
      msg,
    );
  }
}
