import {
  apiError,
  apiSuccess,
  authenticateIngress,
  enforceRateLimit,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getPool } from "@/lib/db/pool";
import {
  assertTargetKind,
  insertTarget,
  listTargets,
  validateIdentifier,
} from "@/lib/targets/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const rate = enforceRateLimit(req, requestId, "pub:targets", 120);
  if (!rate.ok) return rate.response;

  const session = await readWalletSession(req);
  if (!session) {
    return apiError(requestId, "FORBIDDEN", "Wallet session required.", 403);
  }

  const pool = getPool();
  if (!pool) {
    return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
  }

  try {
    const rows = await listTargets({ pool, wallet: session.sub, includeArchived: false });
    return apiSuccess(requestId, {
      targets: rows.map(rowToDto),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to list targets.", 500, msg);
  }
}

export async function POST(req: Request) {
  const ingress = authenticateIngress(req);
  if (!ingress.ok) return ingress.response;
  const { requestId } = ingress;

  const rate = enforceRateLimit(req, requestId, "pub:targets-post", 30);
  if (!rate.ok) return rate.response;

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

  const kindRaw = (body as { kind?: unknown }).kind;
  const identifierRaw = (body as { identifier?: unknown }).identifier;
  const labelRaw = (body as { label?: unknown }).label;

  if (typeof kindRaw !== "string" || typeof identifierRaw !== "string") {
    return apiError(requestId, "BAD_REQUEST", "kind and identifier are required.", 400);
  }

  try {
    assertTargetKind(kindRaw);
    const identifier = validateIdentifier(kindRaw, identifierRaw);
    const row = await insertTarget({
      pool,
      wallet: session.sub,
      kind: kindRaw,
      identifier,
      label: typeof labelRaw === "string" ? labelRaw : null,
    });
    return apiSuccess(requestId, { target: rowToDto(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("invalid_")) {
      return apiError(requestId, "BAD_REQUEST", msg, 400);
    }
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return apiError(requestId, "BAD_REQUEST", "Target already exists.", 409);
    }
    return apiError(requestId, "INTERNAL_ERROR", "Failed to create target.", 500, msg);
  }
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
