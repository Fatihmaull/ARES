import type { VulnerabilityCase, VulnerabilityCategory, Severity } from "./protocol.js";
import { cvssToSeverity } from "./protocol.js";

/**
 * Load and parse the Solana vulnerability dataset
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATASET_PATH = join(__dirname, "../../../libs/dataset/Solana_vulnerability_audit_dataset_V2/Solana.json");

export async function loadDataset(): Promise<VulnerabilityCase[]> {
  const raw = JSON.parse(readFileSync(DATASET_PATH, "utf-8"));

  return raw.map((item: any, idx: number): VulnerabilityCase => {
    const vulns = item.vulnerabilities || [];
    const category = inferCategory(vulns);
    const severity = inferSeverity(vulns);

    return {
      id: `solana-${String(idx + 1).padStart(4, "0")}`,
      code: item.code,
      vulnerabilities: vulns,
      category,
      severity,
      cvss: severityToCvss(severity),
    };
  });
}

const CATEGORY_KEYWORDS: Record<VulnerabilityCategory, string[]> = {
  REENTRANCY: ["reentrancy", "recursive", "reentracy"],
  ACCESS_CONTROL: ["access control", "unauthorized", "permission", "admin", "authority"],
  ARITHMETIC: ["overflow", "underflow", "integer", "arithmetic", "precision", "calculation"],
  ARBITRARY_CPI: ["arbitrary cpi", "cpi", "cross-program"],
  PDA_VALIDATION: ["pda", "program derived", "bump seed", "bump"],
  SIGNER_AUTH: ["signer", "signature", "authentication", "is_signer"],
  INIT_BYPASS: ["init", "initialization", "reinit", "initialize"],
  PRIVACY: ["privacy", "confidential", "visibility"],
  ORACLE: ["oracle", "price feed", "stale price"],
  OTHER: [],
};

function inferCategory(vulnerabilities: string[]): VulnerabilityCategory {
  const text = vulnerabilities.join(" ").toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        return cat as VulnerabilityCategory;
      }
    }
  }

  return "OTHER";
}

function inferSeverity(vulnerabilities: string[]): Severity {
  const text = vulnerabilities.join(" ").toLowerCase();

  if (text.includes("critical") || text.includes("fund loss") || text.includes("drain")) {
    return "CRITICAL";
  }
  if (text.includes("high") || text.includes("exploit")) {
    return "HIGH";
  }
  if (text.includes("medium") || text.includes("moderate")) {
    return "MEDIUM";
  }
  return "LOW";
}

function severityToCvss(severity: Severity): number {
  switch (severity) {
    case "CRITICAL": return 9.1;
    case "HIGH": return 7.5;
    case "MEDIUM": return 5.0;
    case "LOW": return 3.0;
  }
}

export async function filterByCategory(
  cases: VulnerabilityCase[],
  categories: VulnerabilityCategory[]
): Promise<VulnerabilityCase[]> {
  return cases.filter(c => categories.includes(c.category));
}

export async function filterBySeverity(
  cases: VulnerabilityCase[],
  severity: Severity
): Promise<VulnerabilityCase[]> {
  return cases.filter(c => c.severity === severity);
}

export async function getVulnerableCases(
  cases: VulnerabilityCase[]
): Promise<VulnerabilityCase[]> {
  return cases.filter(c => c.vulnerabilities.length > 0);
}

export async function getSecureCases(
  cases: VulnerabilityCase[]
): Promise<VulnerabilityCase[]> {
  return cases.filter(c => c.vulnerabilities.length === 0);
}

export function getCaseCount(cases: VulnerabilityCase[]): {
  total: number;
  vulnerable: number;
  secure: number;
  byCategory: Record<VulnerabilityCategory, number>;
  bySeverity: Record<Severity, number>;
} {
  const vulnerable = cases.filter(c => c.vulnerabilities.length > 0);
  const secure = cases.filter(c => c.vulnerabilities.length === 0);

  const byCategory: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const c of cases) {
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
  }

  return {
    total: cases.length,
    vulnerable: vulnerable.length,
    secure: secure.length,
    byCategory: byCategory as Record<VulnerabilityCategory, number>,
    bySeverity: bySeverity as Record<Severity, number>,
  };
}