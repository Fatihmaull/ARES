import { getAssuranceData } from "@/lib/data";
import { apiError, apiSuccess, requireApiKey } from "@/lib/api";
import { resolveRepoRoot } from "@/lib/paths";

export async function GET(req: Request) {
  const auth = requireApiKey(req);
  if (!auth.ok) return auth.response;
  const { requestId } = auth;

  try {
    const { supplyChain } = getAssuranceData();

    // Extract findings from all sources
    const findings: any[] = [];

    // From SARIF
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

    // From supply chain
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

    // From last scan results
    const scanPath = path.join(assuranceDir, "..", ".asst", "last-scan.json");
    if (fs.existsSync(scanPath)) {
      try {
        const scan = JSON.parse(fs.readFileSync(scanPath, "utf8"));
        for (const result of scan.results || []) {
          if (result.output?.includes("EXPOSURE") || result.output?.includes("Critical")) {
            findings.push({
              source: result.agent,
              severity: result.output.includes("Critical") ? "Critical" : "High",
              rule: `${result.agent}-finding`,
              message: result.output.substring(0, 200),
              location: "scan-result",
              line: 0,
            });
          }
        }
      } catch (error) {
        console.warn("Failed to parse last-scan.json:", error);
      }
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4 };
    findings.sort((a, b) => (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4));

    return apiSuccess(requestId, {
      total: findings.length,
      bySeverity: {
        critical: findings.filter(f => f.severity === "Critical").length,
        high: findings.filter(f => f.severity === "High").length,
        medium: findings.filter(f => f.severity === "Medium").length,
        low: findings.filter(f => f.severity === "Low").length,
      },
      findings: findings.slice(0, 100),
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return apiError(requestId, "INTERNAL_ERROR", "Failed to load findings.", 500, error.message);
  }
}
