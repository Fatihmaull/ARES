import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { apiError, enforceRateLimit, requireApiKeyOrPublic } from "@/lib/api";
import { ensureWithinRoot, resolveRepoRoot } from "@/lib/paths";

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;
  const rate = enforceRateLimit(req, requestId, "report", 60);
  if (!rate.ok) return rate.response;

  const { searchParams } = new URL(req.url);
  const repo = searchParams.get("repo") || "ASST";

  if (!/^[a-zA-Z0-9._ -]{1,80}$/.test(repo)) {
    return apiError(requestId, "BAD_REQUEST", "Invalid report identifier.", 400);
  }

  const fileName = `${repo} final analysis report.pdf`;
  const assuranceDir = resolve(resolveRepoRoot(), "assurance");
  const filePath = resolve(join(assuranceDir, fileName));

  if (!ensureWithinRoot(assuranceDir, filePath)) {
    return apiError(requestId, "FORBIDDEN", "Invalid report path.", 403);
  }

  if (!existsSync(filePath)) {
    return apiError(requestId, "NOT_FOUND", "Report not found.", 404);
  }

  try {
    const fileBuffer = await readFile(filePath);
    
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to read report.", 500, error.message);
  }
}
