import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  apiError,
  apiSuccess,
  requireApiKeyOrPublic,
} from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import {
  insertDebitPending,
  refundDebit,
  getBalanceUnits,
} from "@/lib/billing/ledger";
import { ACTION_COST_UNITS } from "@/lib/billing/pricing";
import { getRun } from "@/lib/billing/runs";
import { listReports } from "@/lib/billing/reports";
import { getAssuranceData } from "@/lib/data";
import { getPool } from "@/lib/db/pool";
import { resolveRepoRoot } from "@/lib/paths";

import { enqueueReportResponse } from "@/lib/scan/enqueue-report";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(100, Math.max(1, Number.parseInt(limitRaw || "40", 10) || 40));

  const pool = getPool();
  if (pool) {
    try {
      const session = await readWalletSession(req);
      const rows = await listReports({ pool, wallet: session?.sub ?? null, limit });
      return apiSuccess(requestId, {
        source: "db",
        reports: rows.map((r) => ({
          id: r.id,
          name: r.title,
          type: r.kind,
          date: r.created_at.toISOString().split("T")[0],
          status: "verified",
          path: `/api/reports/download?id=${encodeURIComponent(r.id)}`,
          summary: r.summary,
          runId: r.run_id,
        })),
      });
    } catch (error: any) {
      return apiError(requestId, "INTERNAL_ERROR", "Failed to list reports.", 500, error.message);
    }
  }

  // Filesystem fallback (dev only).
  try {
    const data = getAssuranceData();
    const repoRoot = data.latest?.repoRoot || resolveRepoRoot();
    const reportsDir = join(repoRoot, ".asst", "reports");

    let reports: any[] = [];
    if (existsSync(reportsDir)) {
      const files = readdirSync(reportsDir).filter((f) => f.endsWith(".pdf"));
      reports = files.map((file) => {
        const stats = statSync(join(reportsDir, file));
        return {
          id: file,
          name: file
            .replace(".pdf", "")
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" "),
          type: "security_audit",
          date: stats.mtime.toISOString().split("T")[0],
          status: "verified",
          size: `${(stats.size / 1024 / 1024).toFixed(1)} MB`,
          path: `/api/reports/download?file=${encodeURIComponent(file)}`,
        };
      });
    }
    return apiSuccess(requestId, { source: "filesystem", reports });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to list reports.", 500, error.message);
  }
}

export async function POST(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

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

  const parentRunId =
    typeof (body as { parentRunId?: unknown }).parentRunId === "string"
      ? (body as { parentRunId: string }).parentRunId.trim()
      : "";
  if (!parentRunId) {
    return apiError(requestId, "BAD_REQUEST", "parentRunId is required.", 400);
  }

  const parent = await getRun(pool, parentRunId);
  if (!parent || parent.wallet !== session.sub) {
    return apiError(requestId, "FORBIDDEN", "Parent run not found for this wallet.", 403);
  }

  const wallet = session.sub;
  const balance = await getBalanceUnits(pool, wallet);
  if (balance < ACTION_COST_UNITS.report) {
    return apiError(
      requestId,
      "FORBIDDEN",
      "Insufficient credits to synthesize a report.",
      402,
    );
  }

  const runId = crypto.randomUUID();
  let debitId: number | undefined;
  try {
    debitId = await insertDebitPending({
      pool,
      wallet,
      units: ACTION_COST_UNITS.report,
      reason: "report",
      relatedRunId: runId,
    });
    return enqueueReportResponse({
      runId,
      requestId,
      wallet,
      parentRunId,
      provisionalDebitId: debitId,
    });
  } catch (err) {
    if (debitId !== undefined) await refundDebit(pool, debitId);
    const msg = err instanceof Error ? err.message : String(err);
    return apiError(requestId, "INTERNAL_ERROR", "Failed to enqueue report.", 500, msg);
  }
}
