import { apiError, apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { upsertWalletFree } from "@/lib/billing/ledger";
import { getPool } from "@/lib/db/pool";
import { isAdminWallet } from "@/lib/admin";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  if (!session || !isAdminWallet(session.sub)) {
    return apiError(requestId, "FORBIDDEN", "Admin wallet session required.", 403);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  let body: {
    wallet?: string;
    units?: number;
    direction?: string;
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  const units =
    typeof body.units === "number" && Number.isFinite(body.units) ? Math.floor(body.units) : NaN;
  const direction = body.direction === "DEBIT" ? "DEBIT" : "CREDIT";
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "admin_adjust";

  if (!wallet || units <= 0) {
    return apiError(requestId, "BAD_REQUEST", "wallet and positive units are required.", 400);
  }

  await upsertWalletFree(pool, wallet);

  await pool.query(
    `INSERT INTO credits_ledger (wallet, direction, units, reason, status, meta)
     VALUES ($1, $2, $3, $4, 'SETTLED', $5::jsonb)`,
    [
      wallet,
      direction,
      units,
      reason,
      JSON.stringify({ actor: session.sub }),
    ],
  );

  return apiSuccess(requestId, {
    wallet,
    direction,
    units,
    reason,
  });
}
