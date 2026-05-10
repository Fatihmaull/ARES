import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { apiError, enforceRateLimit, requireApiKeyOrPublic } from "@/lib/api";
import { contentDispositionAttachment, sanitizePdfFilename } from "@/lib/download-filename";
import { getReportArtifact, getReportTitle } from "@/lib/billing/reports";
import { getAssuranceData } from "@/lib/data";
import { getPool } from "@/lib/db/pool";
import { ensureWithinRoot, resolveRepoRoot } from "@/lib/paths";
import { getObjectStore } from "@/lib/storage/objectStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;
  const rate = enforceRateLimit(req, requestId, "reports-download", 60);
  if (!rate.ok) return rate.response;

  const { searchParams } = new URL(req.url);
  const reportId = searchParams.get("id");
  const file = searchParams.get("file");

  // Preferred path: Postgres-backed reports + signed URL from object storage.
  if (reportId) {
    try {
      const pool = getPool();
      if (!pool) {
        return apiError(requestId, "INTERNAL_ERROR", "DATABASE_URL is not configured.", 503);
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(reportId)) {
        return apiError(requestId, "BAD_REQUEST", "Invalid report id.", 400);
      }
      const artifact = await getReportArtifact(pool, reportId);
      if (!artifact) {
        return apiError(requestId, "NOT_FOUND", "Report not found.", 404);
      }

      const dbTitle = await getReportTitle(pool, reportId);
      const attachmentName = sanitizePdfFilename(dbTitle ?? "", reportId);

      if (artifact.bucket === "local-fs") {
        const repoRoot = resolveRepoRoot();
        const filePath = resolve(repoRoot, artifact.object_key);
        const reportsDir = resolve(repoRoot, ".asst", "reports");
        if (!ensureWithinRoot(reportsDir, filePath)) {
          return apiError(requestId, "FORBIDDEN", "Invalid report path.", 403);
        }
        if (!existsSync(filePath)) {
          return apiError(requestId, "NOT_FOUND", "Report file missing on disk.", 404);
        }
        const content = readFileSync(filePath);
        return new NextResponse(new Uint8Array(content), {
          headers: {
            "Content-Type": artifact.content_type || "application/pdf",
            "Content-Disposition": contentDispositionAttachment(attachmentName),
          },
        });
      }

      const store = getObjectStore();
      if (!store) {
        return apiError(
          requestId,
          "INTERNAL_ERROR",
          "Object storage is not configured.",
          503,
        );
      }
      const signedUrl = await store.signedGet(artifact.object_key, { expiresInSeconds: 600 });

      const ctrl = new AbortController();
      const kill = setTimeout(() => ctrl.abort(), 120_000);
      let upstream: Response;
      try {
        upstream = await fetch(signedUrl, { redirect: "follow", signal: ctrl.signal });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return apiError(
          requestId,
          "INTERNAL_ERROR",
          "Failed to fetch report from storage.",
          502,
          msg,
        );
      } finally {
        clearTimeout(kill);
      }

      if (!upstream.ok) {
        return apiError(
          requestId,
          "INTERNAL_ERROR",
          "Report storage returned an error.",
          upstream.status >= 400 ? upstream.status : 502,
        );
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      const contentType =
        upstream.headers.get("content-type") || artifact.content_type || "application/pdf";

      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": contentType.split(";")[0]!.trim(),
          "Content-Disposition": contentDispositionAttachment(attachmentName),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[reports/download]", reportId, err);
      return apiError(requestId, "INTERNAL_ERROR", "Failed to serve report download.", 500, msg);
    }
  }

  // Filesystem fallback (dev only).
  if (!file) {
    return apiError(requestId, "BAD_REQUEST", "No file or id specified.", 400);
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
    return new NextResponse(new Uint8Array(content), {
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
