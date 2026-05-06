import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { isAdminWallet } from "@/lib/admin";
import { readWalletSession } from "@/lib/auth/read-session";
import { expirePendingPurchases } from "@/lib/billing/purchases";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";

/**
 * Admin-only PayAI reconciliation hook. Called hourly by Vercel Cron (GET) and
 * also reachable by an admin wallet or shared API key (POST).
 *  - Cancels expired pending purchases.
 *  - Returns recent provider events with non-CREDITED results for manual triage.
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const requestId = getRequestId(req);

  if (!(await authorize(req))) {
    return apiError(requestId, "FORBIDDEN", "Admin only.", 403);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const expired = await expirePendingPurchases(pool);

  const rejects = await pool.query<{
    id: string;
    idempotency_key: string;
    result: string;
    error: string | null;
    related_purchase_id: string | null;
    created_at: Date;
  }>(
    `SELECT id::text, idempotency_key, result, error, related_purchase_id::text, created_at
       FROM payment_provider_events
      WHERE provider = 'payai'
        AND result IN ('REJECTED', 'IGNORED')
        AND created_at > now() - INTERVAL '24 hours'
      ORDER BY id DESC
      LIMIT 100`,
  );

  // Also expire premium tiers whose grant period has passed.
  await pool.query(
    `UPDATE wallets
        SET tier = 'paid', tier_expires_at = NULL
      WHERE tier = 'premium' AND tier_expires_at IS NOT NULL AND tier_expires_at < now()`,
  );

  return apiSuccess(requestId, {
    expiredPending: expired,
    recentRejects: rejects.rows.map((r) => ({
      id: r.id,
      idempotencyKey: r.idempotency_key,
      result: r.result,
      error: r.error,
      purchaseId: r.related_purchase_id,
      createdAt: r.created_at.toISOString(),
    })),
  });
}

async function authorize(req: Request): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get("authorization")?.trim();
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const expectedKey = process.env.ASST_WEB_API_KEY?.trim();
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (expectedKey && headerKey && headerKey === expectedKey) return true;

  const session = await readWalletSession(req);
  if (session && isAdminWallet(session.sub)) return true;

  return false;
}
