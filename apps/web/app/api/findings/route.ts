import { apiError, apiSuccess, requireApiKeyOrPublic } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { listFindings } from "@/lib/billing/reports";
import { getAssuranceData } from "@/lib/data";
import { getPool } from "@/lib/db/pool";
import { resolveRepoRoot } from "@/lib/paths";

export const runtime = "nodejs";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export async function GET(req: Request) {
  const auth = requireApiKeyOrPublic(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(200, Math.max(1, Number.parseInt(limitRaw || "100", 10) || 100));

  const pool = getPool();
  if (pool) {
    try {
      const session = await readWalletSession(req);
      const rows = await listFindings({
        pool,
        wallet: session?.sub ?? null,
        limit,
      });
      const findings = rows.map((r) => ({
        id: r.id,
        source: r.agent,
        severity: capitalize(r.severity),
        rule: typeof r.detail?.rule === "string" ? r.detail.rule : `${r.agent}-finding`,
        message: r.title,
        location:
          typeof r.detail?.location === "string" ? (r.detail.location as string) : null,
        line: typeof r.detail?.line === "number" ? r.detail.line : 0,
        runId: r.run_id,
        createdAt: r.created_at.toISOString(),
        status: r.status ?? "open",
        notes: r.notes ?? null,
        resolvedAt: r.resolved_at?.toISOString() ?? null,
      }));
      findings.sort(
        (a, b) =>
          (SEVERITY_ORDER[a.severity.toLowerCase()] ?? 4) -
          (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 4),
      );
      const bySeverity = {
        critical: findings.filter((f) => f.severity === "Critical").length,
        high: findings.filter((f) => f.severity === "High").length,
        medium: findings.filter((f) => f.severity === "Medium").length,
        low: findings.filter((f) => f.severity === "Low").length,
      };
      return apiSuccess(requestId, {
        source: "db",
        total: findings.length,
        bySeverity,
        findings,
        generatedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      return apiError(requestId, "INTERNAL_ERROR", "Failed to load findings.", 500, error.message);
    }
  }

  // Filesystem fallback (dev only).
  try {
    const { supplyChain } = getAssuranceData();
    const findings: any[] = [];
    const fs = await import("node:fs");
    const path = await import("node:path");
    const assuranceDir = path.join(resolveRepoRoot(), "assurance");
    const sarifPath = path.join(assuranceDir, "merged.sarif.json");
    if (fs.existsSync(sarifPath)) {
      try {
        const sarif = JSON.parse(fs.readFileSync(sarifPath, "utf8"));
        const results = sarif?.runs?.[0]?.results || [];
        for (const r of results) {
          findings.push({
            source: "semgrep",
            severity: r.level === "error" ? "High" : r.level === "warning" ? "Medium" : "Low",
            rule: r.ruleId || "unknown",
            message: r.message?.text || "",
            location: r.locations?.[0]?.physicalLocation?.artifactLocation?.uri || "",
            line: r.locations?.[0]?.physicalLocation?.region?.startLine || 0,
          });
        }
      } catch (error) {
        console.warn("Failed to parse merged.sarif.json:", error);
      }
    }
    if (supplyChain?.npm?.vulnerabilities) {
      const vuln = supplyChain.npm.vulnerabilities;
      if (vuln.total > 0) {
        findings.push({
          source: "npm-audit",
          severity: vuln.critical > 0 ? "Critical" : vuln.high > 0 ? "High" : "Medium",
          rule: "supply-chain-vulnerability",
          message: `NPM: ${vuln.total} vulnerabilities (${vuln.critical || 0} critical, ${vuln.high || 0} high)`,
          location: "package.json",
          line: 0,
        });
      }
    }
    findings.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity.toLowerCase()] ?? 4) -
        (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 4),
    );
    return apiSuccess(requestId, {
      source: "filesystem",
      total: findings.length,
      bySeverity: {
        critical: findings.filter((f) => f.severity === "Critical").length,
        high: findings.filter((f) => f.severity === "High").length,
        medium: findings.filter((f) => f.severity === "Medium").length,
        low: findings.filter((f) => f.severity === "Low").length,
      },
      findings: findings.slice(0, 100),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to load findings.", 500, error.message);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
