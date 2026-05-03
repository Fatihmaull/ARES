import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getAssuranceData } from "@/lib/data";
import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { resolveRepoRoot } from "@/lib/paths";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  try {
    const data = getAssuranceData();
    const repoRoot = data.latest?.repoRoot || resolveRepoRoot();
    const reportsDir = join(repoRoot, ".asst", "reports");

    let reports: any[] = [];

    if (existsSync(reportsDir)) {
      const files = readdirSync(reportsDir).filter(f => f.endsWith('.pdf'));
      reports = files.map(file => {
        const stats = statSync(join(reportsDir, file));
        return {
          id: file,
          name: file.replace('.pdf', '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          type: 'security_audit',
          date: stats.mtime.toISOString().split('T')[0],
          status: 'verified',
          size: `${(stats.size / 1024 / 1024).toFixed(1)} MB`,
          path: `/api/reports/download?file=${encodeURIComponent(file)}`
        };
      });
    }

    return apiSuccess(requestId, { reports });
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
