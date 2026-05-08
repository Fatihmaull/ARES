import {
  apiError,
  apiSuccess,
  authenticateIngress,
  enforceRateLimit,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getPool } from "@/lib/db/pool";
import {
  deleteTarget,
  getTarget,
  updateTarget,
} from "@/lib/targets/store";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const rate = enforceRateLimit(req, requestId, "pub:targets-one", 120);
  if (!rate.ok) return rate.response;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const { id } = await ctx.params;
  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  try {
    const row = await getTarget({ pool, wallet: session.sub, id });
    if (!row) return apiError(requestId, "NOT_FOUND", "Target not found.", 404);
    return apiSuccess(requestId, { target: rowToDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to load target.", 500, msg);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const { id } = await ctx.params;
  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const label = (body as { label?: unknown }).label;
  const archived = (body as { archived?: unknown }).archived;

  try {
    const row = await updateTarget({
      pool,
      wallet: session.sub,
      id,
      label: typeof label === "string" ? label : undefined,
      archived: typeof archived === "boolean" ? archived : undefined,
    });
    if (!row) return apiError(requestId, "NOT_FOUND", "Target not found.", 404);
    return apiSuccess(requestId, { target: rowToDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to update target.", 500, msg);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const { id } = await ctx.params;
  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const ok = await deleteTarget({ pool, wallet: session.sub, id });
  if (!ok) return apiError(requestId, "NOT_FOUND", "Target not found.", 404);
  return apiSuccess(requestId, { deleted: true });
}

function rowToDto(row: {
  id: string;
  wallet: string;
  kind: string;
  identifier: string;
  label: string | null;
  created_at: Date;
  last_scanned_at: Date | null;
  last_run_id: string | null;
  archived_at: Date | null;
}) {
  return {
    id: row.id,
    wallet: row.wallet,
    kind: row.kind,
    identifier: row.identifier,
    label: row.label,
    createdAt: row.created_at.toISOString(),
    lastScannedAt: row.last_scanned_at?.toISOString() ?? null,
    lastRunId: row.last_run_id,
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}
