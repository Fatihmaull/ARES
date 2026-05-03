import { createPublicOrchestrator } from "@/lib/engine-factory";
import {
  apiError,
  apiSuccess,
  authenticateIngress,
  enforceRateLimit,
  getClientIp,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import {
  getBalanceUnits,
  insertDebitPending,
  refundDebit,
  settleDebit,
} from "@/lib/billing/ledger";
import { ACTION_COST_UNITS } from "@/lib/billing/pricing";
import { consumeWalletFreeScan } from "@/lib/billing/quota";
import { getPool } from "@/lib/db/pool";
import { enforceWalletRateLimit } from "@/lib/ratelimit/wallet";

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

  async function invokeScan(): Promise<Response> {
    try {
      const ares = createPublicOrchestrator({ model });

      ares.runFullScan((agent, status) => {
        if (process.env.NODE_ENV !== "production") {
          console.log(`[scan] ${agent}: ${status}`);
        }
      }).catch((err) => {
        console.error("[ARES Scan Error]:", err);
      });

      return apiSuccess(requestId, {
        status: "queued",
        message: "Security scan initiated successfully.",
        target,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("API Scan Route Error:", error);
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "Failed to initiate ARES scan.",
        500,
        msg || "Unknown execution error",
      );
    }
  }

  if (operator) {
    return invokeScan();
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
      });
      const res = await invokeScan();
      if (res.status === 200 && debitId !== undefined) {
        await settleDebit(pool, debitId);
      } else if (debitId !== undefined) {
        await refundDebit(pool, debitId);
      }
      return res;
    } catch (error: unknown) {
      if (debitId !== undefined) await refundDebit(pool, debitId);
      throw error;
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

  return invokeScan();
}
