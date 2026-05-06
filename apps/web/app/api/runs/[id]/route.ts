import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getRun } from "@/lib/billing/runs";
import { getPool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const { id } = await ctx.params;
  if (!id) return apiError(requestId, "BAD_REQUEST", "Run id required.", 400);

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const row = await getRun(pool, id);
  if (!row) return apiError(requestId, "NOT_FOUND", "Run not found.", 404);

  // Wallet-scoped access: anyone with the API key (operator) sees all; otherwise the
  // owning wallet must match. Anonymous (no session, no key) gets nothing.
  const session = await readWalletSession(req);
  if (!session && row.wallet) {
    return apiError(requestId, "FORBIDDEN", "Authenticate with the run's wallet.", 403);
  }
  if (session && row.wallet && row.wallet !== session.sub) {
    return apiError(requestId, "FORBIDDEN", "Run belongs to a different wallet.", 403);
  }

  return apiSuccess(requestId, {
    id: row.id,
    kind: row.kind,
    status: row.status,
    target: row.target,
    model: row.model,
    requestId: row.request_id,
    unitsBilled: row.units_billed ? Number.parseInt(row.units_billed, 10) : null,
    error: row.error,
    trace: row.trace,
    meta: row.meta,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
  });
}
