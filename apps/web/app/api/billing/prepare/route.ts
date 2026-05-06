import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { loadActiveCatalog, getFallbackCatalog } from "@/lib/billing/catalog";
import { createPendingPurchase, setPurchasePayAIId } from "@/lib/billing/purchases";
import { TOPUP_BUNDLES } from "@/lib/billing/pricing";
import { getPool } from "@/lib/db/pool";
import {
  PayAIError,
  createPayAICheckout,
  isPayAISkuEnabled,
  readPayAIConfig,
} from "@/lib/payments/payai";

const PURCHASE_TTL_MS = 30 * 60_000; // 30 minutes

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "UNAUTHORIZED", "Wallet session required.", 401);
  }

  let bundleId = "";
  try {
    const body = await req.json();
    bundleId = typeof body?.bundleId === "string" ? body.bundleId.trim() : "";
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  // Resolve SKU from the active pricing catalog (DB) with static fallback.
  const pool = getPool();
  const catalog = pool ? await loadActiveCatalog(pool) : getFallbackCatalog();
  const sku =
    catalog.skus.find((s) => s.id === bundleId) ??
    TOPUP_BUNDLES.filter((b) => b.id === bundleId).map((b) => ({
      id: b.id,
      label: b.label,
      amountUsdc: b.usdc,
      unitsCredited: b.units,
      tier: "paid" as const,
      tierFlipDurationDays: null,
    }))[0];

  if (!sku) {
    return apiError(requestId, "BAD_REQUEST", "Unknown bundle.", 400);
  }

  // PayAI primary rail.
  const payCfg = readPayAIConfig();
  if (payCfg && isPayAISkuEnabled(payCfg, sku.id)) {
    if (!pool) {
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "DATABASE_URL is required for PayAI top-ups.",
        503,
      );
    }
    try {
      const purchase = await createPendingPurchase({
        pool,
        wallet: session.sub,
        skuId: sku.id,
        amountUsdc: sku.amountUsdc,
        unitsExpected: sku.unitsCredited,
        expiresAt: new Date(Date.now() + PURCHASE_TTL_MS),
        meta: { requestId, source: "prepare" },
      });

      const checkout = await createPayAICheckout(payCfg, {
        purchaseId: purchase.id,
        wallet: session.sub,
        skuId: sku.id,
        amountUsdc: sku.amountUsdc,
        unitsCredited: sku.unitsCredited,
      });
      if (checkout.payaiPaymentId) {
        await setPurchasePayAIId(pool, purchase.id, checkout.payaiPaymentId);
      }

      return apiSuccess(requestId, {
        rail: "payai",
        purchaseId: purchase.id,
        bundleId: sku.id,
        units: sku.unitsCredited,
        usdc: sku.amountUsdc,
        label: sku.label,
        checkoutUrl: checkout.checkoutUrl ?? null,
        x402: checkout.x402 ?? null,
        payaiPaymentId: checkout.payaiPaymentId ?? null,
      });
    } catch (err: unknown) {
      const detail =
        err instanceof PayAIError
          ? `${err.message}${err.status ? ` (${err.status})` : ""}`
          : err instanceof Error
            ? err.message
            : String(err);
      return apiError(
        requestId,
        "INTERNAL_ERROR",
        "Failed to start PayAI checkout.",
        502,
        detail,
      );
    }
  }

  // Legacy memo rail fallback (no PayAI configured).
  const treasury = process.env.ASST_TREASURY_WALLET?.trim();
  if (!treasury) {
    return apiError(
      requestId,
      "INTERNAL_ERROR",
      "No payment rail configured (PayAI absent and ASST_TREASURY_WALLET unset).",
      503,
    );
  }

  const clientNonce = crypto.randomUUID();
  const memo = `ASST:${session.sub}:${sku.id}:${clientNonce}`;

  return apiSuccess(requestId, {
    rail: "memo",
    treasury,
    memo,
    bundleId: sku.id,
    units: sku.unitsCredited,
    usdc: sku.amountUsdc,
    label: sku.label,
    clientNonce,
    mintUsdc: process.env.ASST_DEPOSIT_MINT_USDC?.trim() || null,
  });
}
