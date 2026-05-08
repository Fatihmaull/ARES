/**
 * Purchase + payment-provider-event helpers.
 *
 * The lifecycle is owned by the API routes:
 *   prepare → createPendingPurchase()
 *   webhook → recordProviderEvent() + creditFromSettledPurchase()
 *   reconcile cron → expirePendingPurchases()
 */
import type pg from "pg";

export type PurchaseStatus = "PENDING" | "SETTLED" | "CANCELED" | "FAILED";

export interface PendingPurchaseInput {
  pool: pg.Pool;
  wallet: string;
  skuId: string;
  amountUsdc: number;
  unitsExpected: number;
  expiresAt?: Date | null;
  meta?: Record<string, unknown>;
}

export interface PurchaseRow {
  id: string;
  wallet: string;
  sku_id: string;
  amount_usdc: string; // numeric — keep string for safety
  units_expected: string;
  status: PurchaseStatus;
  payai_payment_id: string | null;
  created_at: Date;
  settled_at: Date | null;
  expires_at: Date | null;
  meta: Record<string, unknown>;
}

export async function createPendingPurchase(input: PendingPurchaseInput): Promise<PurchaseRow> {
  const r = await input.pool.query<PurchaseRow>(
    `INSERT INTO purchases (wallet, sku_id, amount_usdc, units_expected, status, expires_at, meta)
     VALUES ($1, $2, $3, $4, 'PENDING', $5, $6::jsonb)
     RETURNING id, wallet, sku_id, amount_usdc::text, units_expected::text, status,
               payai_payment_id, created_at, settled_at, expires_at, meta`,
    [
      input.wallet,
      input.skuId,
      input.amountUsdc,
      input.unitsExpected,
      input.expiresAt ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
  const row = r.rows[0]!;
  return row;
}

export async function setPurchasePayAIId(
  pool: pg.Pool,
  id: string,
  payaiPaymentId: string,
): Promise<void> {
  await pool.query(
    `UPDATE purchases
       SET payai_payment_id = $2
     WHERE id = $1
       AND (payai_payment_id IS NULL OR payai_payment_id = $2)`,
    [id, payaiPaymentId],
  );
}

export async function getPurchase(
  pool: pg.Pool,
  id: string,
): Promise<PurchaseRow | null> {
  const r = await pool.query<PurchaseRow>(
    `SELECT id, wallet, sku_id, amount_usdc::text, units_expected::text, status,
            payai_payment_id, created_at, settled_at, expires_at, meta
     FROM purchases WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

/**
 * Atomic operation: record a provider event row and (if SETTLED) flip the purchase
 * to SETTLED + insert the credits_ledger CREDIT row + maybe upgrade tier.
 *
 * Idempotent on `(provider, idempotency_key)` and `payai_payment_id`.
 */
export async function settlePurchaseAndCredit(input: {
  pool: pg.Pool;
  provider: "payai";
  idempotencyKey: string;
  payaiPaymentId: string;
  purchaseId: string;
  amountUsdc: number;
  rawEvent: unknown;
  /** SKU resolution result derived from pricing_catalog. */
  sku: { id: string; unitsCredited: number; tier: "free" | "paid" | "premium"; tierFlipDurationDays: number | null };
}): Promise<{ creditedLedgerId: number | null; result: "CREDITED" | "IGNORED" | "REJECTED" }> {
  const client = await input.pool.connect();
  try {
    await client.query("BEGIN");

    // Look up the purchase first to validate.
    const purRes = await client.query<PurchaseRow>(
      `SELECT id, wallet, sku_id, amount_usdc::text, units_expected::text, status,
              payai_payment_id, created_at, settled_at, expires_at, meta
       FROM purchases WHERE id = $1 FOR UPDATE`,
      [input.purchaseId],
    );
    const purchase = purRes.rows[0];

    // Insert the audit row early — even rejections must be auditable.
    let resultLabel: "CREDITED" | "IGNORED" | "REJECTED" = "REJECTED";
    let errorText: string | null = null;
    if (!purchase) {
      errorText = "purchase_not_found";
    } else if (purchase.sku_id !== input.sku.id) {
      errorText = "sku_mismatch";
    } else if (Number.parseFloat(String(purchase.amount_usdc)) !== input.amountUsdc) {
      errorText = "amount_mismatch";
    }

    let creditedLedgerId: number | null = null;

    if (purchase && purchase.status === "SETTLED" && purchase.payai_payment_id === input.payaiPaymentId) {
      resultLabel = "IGNORED";
      errorText = "already_settled";
    } else if (!errorText && purchase) {
      // Settle the purchase + insert the credit + upgrade tier.
      await client.query(
        `UPDATE purchases
            SET status = 'SETTLED',
                payai_payment_id = $2,
                settled_at = now()
          WHERE id = $1`,
        [purchase.id, input.payaiPaymentId],
      );

      const ledgerRes = await client.query<{ id: string }>(
        `INSERT INTO credits_ledger (wallet, direction, units, reason, status, related_tx_sig, related_run_id, meta)
         VALUES ($1, 'CREDIT', $2, $3, 'SETTLED', NULL, NULL, $4::jsonb)
         RETURNING id`,
        [
          purchase.wallet,
          input.sku.unitsCredited,
          "deposit_payai",
          JSON.stringify({
            skuId: input.sku.id,
            payaiPaymentId: input.payaiPaymentId,
            purchaseId: purchase.id,
          }),
        ],
      );
      creditedLedgerId = Number.parseInt(ledgerRes.rows[0]!.id, 10);

      const tierFlipDays = input.sku.tierFlipDurationDays;
      if (tierFlipDays && tierFlipDays > 0) {
        await client.query(
          `UPDATE wallets
              SET tier = $2,
                  tier_expires_at = GREATEST(COALESCE(tier_expires_at, now()), now()) + ($3 || ' days')::INTERVAL
            WHERE address = $1`,
          [purchase.wallet, input.sku.tier, String(tierFlipDays)],
        );
      } else if (input.sku.tier !== "free") {
        await client.query(
          `UPDATE wallets
              SET tier = CASE WHEN tier = 'premium' THEN 'premium' ELSE $2 END
            WHERE address = $1`,
          [purchase.wallet, input.sku.tier],
        );
      }

      resultLabel = "CREDITED";
    }

    await client.query(
      `INSERT INTO payment_provider_events (provider, idempotency_key, raw, verified, result, related_purchase_id, error)
       VALUES ($1, $2, $3::jsonb, TRUE, $4, $5, $6)
       ON CONFLICT (provider, idempotency_key) DO NOTHING`,
      [
        input.provider,
        input.idempotencyKey,
        JSON.stringify(input.rawEvent),
        resultLabel,
        purchase?.id ?? null,
        errorText,
      ],
    );

    await client.query("COMMIT");
    return { creditedLedgerId, result: resultLabel };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function expirePendingPurchases(pool: pg.Pool): Promise<number> {
  const r = await pool.query(
    `UPDATE purchases
        SET status = 'CANCELED', settled_at = now()
      WHERE status = 'PENDING' AND expires_at IS NOT NULL AND expires_at < now()`,
  );
  return r.rowCount ?? 0;
}

export async function cancelPendingPurchaseForWallet(
  pool: pg.Pool,
  purchaseId: string,
  wallet: string,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE purchases
        SET status = 'CANCELED'
      WHERE id = $1::uuid AND wallet = $2 AND status = 'PENDING'
      RETURNING id`,
    [purchaseId, wallet],
  );
  return (r.rowCount ?? 0) > 0;
}
