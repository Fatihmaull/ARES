/**
 * PayAI client — primary cash-in rail.
 *
 * Responsibilities:
 *  - Build "checkout intents" for the prepare route (returns whatever client params
 *    the wallet/x402 flow needs to complete a payment).
 *  - Verify webhook signatures.
 *  - Parse webhook events into a normalized shape that the credit-grant route consumes.
 *
 * IMPORTANT: This module never touches the credits ledger directly. The webhook route
 * is responsible for ledger writes; this module only normalizes the inputs.
 *
 * The exact wire shape of PayAI is documented at https://docs.payai.network/. Where
 * fields are uncertain, we accept supersets and surface them in `meta` so admin
 * reconciliation can trace any field we did not consume.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type PayAIEnvironment = "sandbox" | "production";

export interface PayAIConfig {
  baseUrl: string;
  apiKey: string;
  webhookSecret: string;
  merchantId?: string;
  enabledSkus: string[];
  returnUrl?: string;
  cancelUrl?: string;
  environment: PayAIEnvironment;
}

export interface PayAICreateIntentInput {
  /** Internal purchase id used as the correlation key throughout the system. */
  purchaseId: string;
  wallet: string;
  skuId: string;
  amountUsdc: number;
  /** Bare units that will be credited on success — included for receipts/UI only. */
  unitsCredited: number;
  metadata?: Record<string, string>;
}

export interface PayAICheckoutParams {
  /** PayAI's identifier (used to match webhook events back to this purchase). */
  payaiPaymentId?: string;
  /** Hosted checkout URL (when applicable) the user can be redirected to. */
  checkoutUrl?: string;
  /** x402 client params for direct in-wallet flows. */
  x402?: Record<string, unknown>;
  /** Anything else PayAI returned — shown to the UI for diagnostics, never to logs. */
  raw: Record<string, unknown>;
}

export interface PayAIWebhookEvent {
  /** Idempotency key for `payment_provider_events` — required. */
  idempotencyKey: string;
  /** PayAI's payment identifier (matches what was returned by createIntent). */
  paymentId: string;
  /** Internal correlation set in `metadata.purchaseId` when we created the intent. */
  purchaseId: string;
  status: "PENDING" | "SETTLED" | "FAILED" | "CANCELED";
  amountUsdc: number;
  occurredAt: Date;
  raw: unknown;
}

export class PayAIError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "PayAIError";
  }
}

export function readPayAIConfig(): PayAIConfig | null {
  const baseUrl = process.env.PAYAI_BASE_URL?.trim();
  const apiKey = process.env.PAYAI_API_KEY?.trim();
  const webhookSecret = process.env.PAYAI_WEBHOOK_SECRET?.trim();
  if (!baseUrl || !apiKey || !webhookSecret) return null;

  const enabledRaw = process.env.PAYAI_ENABLED_SKUS?.trim();
  const enabledSkus = enabledRaw
    ? enabledRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    webhookSecret,
    merchantId: process.env.PAYAI_MERCHANT_ID?.trim() || undefined,
    enabledSkus,
    returnUrl: process.env.PAYAI_RETURN_URL?.trim() || undefined,
    cancelUrl: process.env.PAYAI_CANCEL_URL?.trim() || undefined,
    environment: (process.env.NODE_ENV === "production" ? "production" : "sandbox") as PayAIEnvironment,
  };
}

export function isPayAISkuEnabled(cfg: PayAIConfig, skuId: string): boolean {
  if (cfg.enabledSkus.length === 0) return true;
  return cfg.enabledSkus.includes(skuId);
}

/**
 * Create a PayAI payment intent / checkout session for a given purchase.
 *
 * The exact endpoint and field names mirror what PayAI publishes; if the
 * upstream surface changes we update the body shape here only. Response is
 * returned as a superset so callers can pass-through any extra params to
 * the wallet flow.
 */
export async function createPayAICheckout(
  cfg: PayAIConfig,
  input: PayAICreateIntentInput,
): Promise<PayAICheckoutParams> {
  const url = `${cfg.baseUrl}/v1/payments/intents`;
  const body = {
    merchantId: cfg.merchantId,
    amount: { value: input.amountUsdc, currency: "USDC" },
    description: `ARES top-up: ${input.skuId} (${input.unitsCredited} units)`,
    successUrl: cfg.returnUrl,
    cancelUrl: cfg.cancelUrl,
    metadata: {
      purchaseId: input.purchaseId,
      wallet: input.wallet,
      skuId: input.skuId,
      ...input.metadata,
    },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
        "x-payai-purchase-id": input.purchaseId,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    throw new PayAIError(
      `PayAI request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let parsed: unknown;
  const text = await res.text();
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new PayAIError(`PayAI ${res.status} ${res.statusText}`, res.status, parsed);
  }

  const data = (parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}) as Record<string, unknown>;
  const payaiPaymentId =
    typeof data.id === "string"
      ? data.id
      : typeof data.paymentId === "string"
        ? data.paymentId
        : undefined;
  const checkoutUrl = typeof data.checkoutUrl === "string" ? data.checkoutUrl : undefined;
  const x402 = data.x402 && typeof data.x402 === "object" ? (data.x402 as Record<string, unknown>) : undefined;

  return { payaiPaymentId, checkoutUrl, x402, raw: data };
}

/**
 * HMAC verification matches the standard signing-secret pattern used by most
 * webhook providers. PayAI's exact header may differ; we accept any of:
 *  - x-payai-signature
 *  - x-signature
 *  - signature
 * If PayAI rotates, only the header constant below needs updating.
 */
export function verifyWebhookSignature(
  cfg: PayAIConfig,
  rawBody: string,
  headers: Record<string, string | undefined>,
): boolean {
  const signature =
    headers["x-payai-signature"] ||
    headers["x-signature"] ||
    headers["signature"] ||
    "";
  if (!signature) return false;
  const expected = createHmac("sha256", cfg.webhookSecret).update(rawBody, "utf8").digest("hex");
  const provided = signature.replace(/^sha256=/, "").trim();
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(provided, "hex"));
  } catch {
    return false;
  }
}

export function deriveIdempotencyKey(
  headers: Record<string, string | undefined>,
  parsed: Record<string, unknown>,
): string | null {
  const direct =
    headers["x-payai-event-id"] ||
    headers["x-event-id"] ||
    headers["idempotency-key"];
  if (typeof direct === "string" && direct.length > 0) return direct;
  if (typeof parsed.id === "string") return parsed.id;
  if (typeof parsed.eventId === "string") return parsed.eventId as string;
  return null;
}

export function parseWebhookEvent(
  rawBody: string,
  headers: Record<string, string | undefined>,
): PayAIWebhookEvent | null {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }

  const idempotencyKey = deriveIdempotencyKey(headers, parsed);
  if (!idempotencyKey) return null;

  const data = (parsed.data && typeof parsed.data === "object" ? parsed.data : parsed) as Record<string, unknown>;
  const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;

  const purchaseId = typeof metadata.purchaseId === "string" ? metadata.purchaseId : undefined;
  const paymentId =
    typeof data.id === "string"
      ? data.id
      : typeof data.paymentId === "string"
        ? (data.paymentId as string)
        : undefined;
  const statusRaw = (typeof data.status === "string" ? data.status : "").toUpperCase();
  const status: PayAIWebhookEvent["status"] =
    statusRaw === "SETTLED" || statusRaw === "PAID" || statusRaw === "COMPLETED"
      ? "SETTLED"
      : statusRaw === "FAILED"
        ? "FAILED"
        : statusRaw === "CANCELED" || statusRaw === "CANCELLED"
          ? "CANCELED"
          : "PENDING";

  const amount = data.amount && typeof data.amount === "object" ? (data.amount as Record<string, unknown>) : {};
  const amountValue = typeof amount.value === "number" ? (amount.value as number) : Number(amount.value || 0);

  const occurredAtRaw =
    typeof data.settledAt === "string"
      ? data.settledAt
      : typeof data.createdAt === "string"
        ? data.createdAt
        : typeof parsed.occurredAt === "string"
          ? (parsed.occurredAt as string)
          : null;
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();

  if (!paymentId || !purchaseId) return null;

  return {
    idempotencyKey,
    paymentId,
    purchaseId,
    status,
    amountUsdc: Number.isFinite(amountValue) ? amountValue : 0,
    occurredAt,
    raw: parsed,
  };
}
