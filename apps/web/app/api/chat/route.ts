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
import { hasUnlimitedCredits } from "@/lib/billing/unlimited-credits";
import { consumeAnonChatQuota, consumeWalletFreeChat } from "@/lib/billing/quota";
import { getPool } from "@/lib/db/pool";
import { enforceWalletRateLimit } from "@/lib/ratelimit/wallet";

const CHAT_TIMEOUT_MS = Number.parseInt(process.env.ASST_CHAT_TIMEOUT_MS ?? "45000", 10) || 45000;

export async function POST(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId, operator } = ingress;

  const rate = enforceRateLimit(req, requestId, operator ? "op:chat" : "pub:chat", operator ? 120 : 30);
  if (!rate.ok) return rate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const prompt =
    typeof (body as { prompt?: unknown })?.prompt === "string"
      ? (body as { prompt: string }).prompt
      : "";
  const model =
    typeof (body as { model?: unknown })?.model === "string"
      ? (body as { model: string }).model
      : undefined;

  if (!prompt.trim()) {
    return apiError(requestId, "BAD_REQUEST", "Prompt is required.", 400);
  }

  const ip = getClientIp(req);

  async function invokeChat(): Promise<Response> {
    try {
      const ares = createPublicOrchestrator({
        model,
      });
      const result = await Promise.race<string>([
        ares.chat(prompt),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error(`Chat timeout after ${CHAT_TIMEOUT_MS}ms`)), CHAT_TIMEOUT_MS),
        ),
      ]);
      return apiSuccess(requestId, { response: result });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("API Route Error:", error);
      const isTimeout = msg.toLowerCase().includes("timeout");
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        isTimeout
          ? "AI provider timed out. Retry, or switch model/provider in your environment."
          : "Failed to communicate with ARES engine.",
        isTimeout ? 504 : 500,
        msg || "Unknown execution error",
      );
    }
  }

  if (operator) {
    return invokeChat();
  }

  const session = await readWalletSession(req);
  const pool = getPool();

  if (session) {
    const wl = await enforceWalletRateLimit(session.sub);
    if (!wl.ok) {
      return apiError(
        requestId,
        "RATE_LIMITED",
        `Wallet rate limit exceeded. Retry after ${wl.retrySec}s.`,
        429,
      );
    }

    if (!pool) {
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "DATABASE_URL is required for wallet-based chat.",
        503,
      );
    }

    const wallet = session.sub;

    if (hasUnlimitedCredits(wallet)) {
      return invokeChat();
    }

    const balance = await getBalanceUnits(pool, wallet);

    if (balance >= ACTION_COST_UNITS.chat) {
      let debitId: number | undefined;
      try {
        debitId = await insertDebitPending({
          pool,
          wallet,
          units: ACTION_COST_UNITS.chat,
          reason: "chat",
        });
        const res = await invokeChat();
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

    const okQuota = await consumeWalletFreeChat(pool, wallet, ip);
    if (!okQuota) {
      return apiError(
        requestId,
        "RATE_LIMITED",
        "Free-tier daily chat quota exceeded. Top up credits or try tomorrow.",
        429,
      );
    }

    return invokeChat();
  }

  const anonOk = await consumeAnonChatQuota(pool, ip);
  if (!anonOk) {
    return apiError(
      requestId,
      "RATE_LIMITED",
      "Anonymous preview limit reached. Sign in with a Solana wallet to continue.",
      429,
    );
  }

  return invokeChat();
}
