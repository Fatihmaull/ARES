import { apiError, apiSuccess, authenticateIngress, enforceRateLimit } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getPool } from "@/lib/db/pool";
import {
  countUnread,
  listNotifications,
  markAllRead,
} from "@/lib/notifications/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const rate = enforceRateLimit(req, requestId, "pub:notifications", 120);
  if (!rate.ok) return rate.response;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") || "40", 10) || 40));

  try {
    const [notifications, unread] = await Promise.all([
      listNotifications({ pool, wallet: session.sub, limit }),
      countUnread(pool, session.sub),
    ]);
    return apiSuccess(requestId, {
      unread,
      notifications: notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        relatedRunId: n.related_run_id,
        relatedPurchaseId: n.related_purchase_id,
        relatedFindingId: n.related_finding_id,
        createdAt: n.created_at.toISOString(),
        readAt: n.read_at?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to list notifications.", 500, msg);
  }
}

export async function POST(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

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

  const action = (body as { action?: unknown }).action;
  if (action !== "mark-all-read") {
    return apiError(requestId, "BAD_REQUEST", "Unsupported action.", 400);
  }

  try {
    const updated = await markAllRead(pool, session.sub);
    return apiSuccess(requestId, { marked: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to update notifications.", 500, msg);
  }
}
