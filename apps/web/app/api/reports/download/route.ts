import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { getAssuranceData } from "@/lib/data";
import { apiError, enforceRateLimit, requireApiKey } from "@/lib/api";
import { ensureWithinRoot } from "@/lib/paths";

export async function GET(req: NextRequest) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;
  const rate = enforceRateLimit(req, requestId, "reports-download", 60);
  if (!rate.ok) return rate.response;

  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");

  if (!file) {
    return apiError(requestId, "BAD_REQUEST", "No file specified.", 400);
  }

  if (!/^[a-zA-Z0-9._-]+\.pdf$/.test(file)) {
    return apiError(requestId, "BAD_REQUEST", "Invalid report filename.", 400);
  }

  try {
    const data = getAssuranceData();
    const repoRoot = data.latest?.repoRoot || process.cwd();
    const reportsDir = resolve(repoRoot, ".asst", "reports");
    const filePath = resolve(reportsDir, file);

    if (!ensureWithinRoot(reportsDir, filePath)) {
      return apiError(requestId, "FORBIDDEN", "Invalid report path.", 403);
    }

    if (!existsSync(filePath)) {
      return apiError(requestId, "NOT_FOUND", "File not found.", 404);
    }

    const content = readFileSync(filePath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${basename(file)}"`,
      },
    });
  } catch (error: any) {
    return apiError(
      requestId,
      "INTERNAL_ERROR",
      "Failed to download report.",
      500,
      error.message,
    );
  }
}
