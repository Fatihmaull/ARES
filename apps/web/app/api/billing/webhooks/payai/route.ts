import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { loadActiveCatalog } from "@/lib/billing/catalog";
import { settlePurchaseAndCredit } from "@/lib/billing/purchases";
import { getPool } from "@/lib/db/pool";
import {
  parseWebhookEvent,
  readPayAIConfig,
  verifyWebhookSignature,
} from "@/lib/payments/payai";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId(req);
  const cfg = readPayAIConfig();
  if (!cfg) {
    return apiError(requestId, "INTERNAL_ERROR", "PayAI is not configured.", 503);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const rawBody = await req.text();
  const headers: Record<string, string | undefined> = {};
  req.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  if (!verifyWebhookSignature(cfg, rawBody, headers)) {
    return apiError(requestId, "UNAUTHORIZED", "Invalid PayAI webhook signature.", 401);
  }

  const event = parseWebhookEvent(rawBody, headers);
  if (!event) {
    return apiError(requestId, "BAD_REQUEST", "Unparseable PayAI event.", 400);
  }

  // Always log the receipt of a verified event, even when we will not credit yet.
  if (event.status !== "SETTLED") {
    await pool.query(
      `INSERT INTO payment_provider_events (provider, idempotency_key, raw, verified, result, related_purchase_id, error)
       VALUES ($1, $2, $3::jsonb, TRUE, 'PENDING', $4, NULL)
       ON CONFLICT (provider, idempotency_key) DO NOTHING`,
      ["payai", event.idempotencyKey, rawBody, event.purchaseId],
    );
    return apiSuccess(requestId, { received: true, status: event.status });
  }

  const catalog = await loadActiveCatalog(pool);
  const sku = catalog.skus.find((s) => s.id);
  // We must look up by the purchase's sku_id, not the SKU table directly,
  // so the credit honors what the user originally bought.
  const purchaseRes = await pool.query<{ sku_id: string }>(
    `SELECT sku_id FROM purchases WHERE id = $1`,
    [event.purchaseId],
  );
  const skuIdFromPurchase = purchaseRes.rows[0]?.sku_id;
  const targetSku = skuIdFromPurchase
    ? catalog.skus.find((s) => s.id === skuIdFromPurchase)
    : sku;

  if (!targetSku) {
    return apiError(
      requestId,
      "BAD_REQUEST",
      "SKU referenced by purchase not present in active catalog.",
      400,
    );
  }

  const { creditedLedgerId, result } = await settlePurchaseAndCredit({
    pool,
    provider: "payai",
    idempotencyKey: event.idempotencyKey,
    payaiPaymentId: event.paymentId,
    purchaseId: event.purchaseId,
    amountUsdc: event.amountUsdc,
    rawEvent: tryParseJson(rawBody),
    sku: {
      id: targetSku.id,
      unitsCredited: targetSku.unitsCredited,
      tier: targetSku.tier,
      tierFlipDurationDays: targetSku.tierFlipDurationDays ?? null,
    },
  });

  return apiSuccess(requestId, {
    received: true,
    result,
    creditedLedgerId,
  });
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
