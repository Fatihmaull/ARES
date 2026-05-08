import {
  apiError,
  apiSuccess,
  authenticateIngress,
  enforceRateLimit,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getPool } from "@/lib/db/pool";
import {
  type FindingWorkflowStatus,
  updateFindingStatus,
} from "@/lib/findings/status";

export const runtime = "nodejs";

const STATUSES = new Set<FindingWorkflowStatus>([
  "open",
  "acknowledged",
  "resolved",
  "wont_fix",
]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId, operator } = ingress;

  const rate = enforceRateLimit(req, requestId, operator ? "op:findings-one" : "pub:findings-one", 120);
  if (!rate.ok) return rate.response;

  const session = await readWalletSession(req);
  if (!operator && !session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session or operator key required.", 403);
  }

  const { id } = await ctx.params;
  if (!id || !/^\d+$/.test(id)) {
    return apiError(requestId, "BAD_REQUEST", "Invalid finding id.", 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(requestId, "BAD_REQUEST", "JSON body required.", 400);
  }

  const statusRaw = (body as { status?: unknown }).status;
  const notes = (body as { notes?: unknown }).notes;

  if (typeof statusRaw !== "string" || !STATUSES.has(statusRaw as FindingWorkflowStatus)) {
    return apiError(requestId, "BAD_REQUEST", "Invalid status.", 400);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  try {
    const { updated } = await updateFindingStatus({
      pool,
      findingId: id,
      wallet: session?.sub ?? null,
      operator,
      status: statusRaw as FindingWorkflowStatus,
      notes: typeof notes === "string" ? notes : notes === null ? null : undefined,
    });
    if (!updated) {
      return apiError(requestId, "NOT_FOUND", "Finding not found or not permitted.", 404);
    }
    return apiSuccess(requestId, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to update finding.", 500, msg);
  }
}
