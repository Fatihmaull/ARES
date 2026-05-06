import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { listReports } from "@/lib/billing/reports";
import { getAssuranceData } from "@/lib/data";
import { getPool } from "@/lib/db/pool";
import { resolveRepoRoot } from "@/lib/paths";

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

  try {
    const body = await req.json().catch(() => ({}));
    return apiSuccess(requestId, {
      status: "queued",
      message: "Report synthesis request accepted.",
      reportType: body?.reportType ?? "security_audit",
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to queue report synthesis.", 500, error.message);
  }
}
