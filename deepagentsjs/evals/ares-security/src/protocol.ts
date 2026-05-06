/**
 * ARES Security Benchmark Protocol
 *
 * Evaluates AI agents on Solana vulnerability detection with:
 * - Detection accuracy (TP/FP/FN/TN)
 * - PoC generation quality
 * - Remediation quality
 * - Speed (elapsed time)
 */

export interface VulnerabilityCase {
  id: string;
  code: string;
  vulnerabilities: string[];
  category: VulnerabilityCategory;
  severity: Severity;
  cvss: number;
  referencePoc?: string;
  referenceRemediation?: string;
}

export type VulnerabilityCategory =
  | "REENTRANCY"
  | "ACCESS_CONTROL"
  | "ARITHMETIC"
  | "ARBITRARY_CPI"
  | "PDA_VALIDATION"
  | "SIGNER_AUTH"
  | "INIT_BYPASS"
  | "PRIVACY"
  | "ORACLE"
  | "OTHER";

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Finding {
  type: VulnerabilityCategory;
  severity: Severity;
  location: { file: string; line: number };
  description: string;
  cwe: string;
  cvss: number;
}

export interface EvaluationResult {
  caseId: string;
  detected: boolean;
  isVulnerable: boolean; // whether reference case has vulnerabilities
  severity: Severity | null;
  truePositive: boolean;
  falsePositive: boolean;
  confidence: number;
  poc: string | null;
  pocQuality: number; // 0-1
  remediation: string | null;
  remediationQuality: number; // 0-1
  elapsedMs: number;
  findings: Finding[];
  /** Harness used for this case (for comparing baseline vs team vs rich). */
  harness?: BenchmarkHarness;
  /** Number of extra user turns after failed compile/syntax check. */
  feedbackRounds?: number;
  /** Captured rustfmt/anchor stderr lines for debugging. */
  compileLog?: string[];
}

export interface BenchmarkMetrics {
  totalCases: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgPocQuality: number;
  avgRemediationQuality: number;
  avgConfidence: number;
  avgElapsedMs: number;
  casesPerHour: number;
}

/** How the benchmark instantiates the agent (baseline vs team vs rich feedback). */
export type BenchmarkHarness =
  | "static"
  | "team"
  | "static_rich"
  | "team_rich";

/** PoC/compile check mode for rich feedback loops. */
export type CompileCheckMode = "off" | "rustfmt" | "anchor";

export interface BenchmarkConfig {
  datasetPath: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  categories: VulnerabilityCategory[];
  minCvss: number;
  outputPath: string;
  /** @default "static" — single DeepAgent, JSON in / JSON out (establishes baseline). */
  harness: BenchmarkHarness;
  /**
   * Extra user/assistant turns when compile check fails (static_rich / team_rich).
   * @default 2
   */
  maxFeedbackRounds: number;
  /**
   * * off — no compile loop (default).
   * * rustfmt — `rustfmt --check` on the PoC string (syntax/parse feedback).
   * * anchor — reserved: run `anchor build` in `anchorWorkspace` when wired.
   */
  compileCheck: CompileCheckMode;
  /** When compileCheck is anchor, path to an Anchor workspace (programs copied by policy). */
  anchorWorkspace?: string;
}

export function isRichHarness(h: BenchmarkHarness): boolean {
  return h === "static_rich" || h === "team_rich";
}

export function defaultBenchmarkConfig(
  base: Partial<BenchmarkConfig> = {}
): BenchmarkConfig {
  return {
    datasetPath:
      base.datasetPath ||
      "../libs/dataset/Solana_vulnerability_audit_dataset_V2/Solana.json",
    modelName: base.modelName || "claude-sonnet-4-20250514",
    temperature: base.temperature ?? 0.1,
    maxTokens: base.maxTokens ?? 4096,
    categories: base.categories ?? [],
    minCvss: base.minCvss ?? 0,
    outputPath: base.outputPath || "./ares-security-report.json",
    harness: base.harness ?? "static",
    maxFeedbackRounds: base.maxFeedbackRounds ?? 2,
    compileCheck: base.compileCheck ?? "off",
    anchorWorkspace: base.anchorWorkspace,
  };
}

export const DEFAULT_PROMPT = `You are an elite Solana security auditor specializing in Anchor/Rust smart contract vulnerability detection.

## Your Task
Analyze the following Solana program for security vulnerabilities. For each vulnerability found:
1. Identify the exact location (file:line)
2. Determine severity (CRITICAL/HIGH/MEDIUM/LOW)
3. Generate a Proof of Concept (PoC) showing exploitation
4. Provide remediation code

## Vulnerability Categories to Check
- REENTRANCY: Missing invoke guards, unchecked external calls
- ACCESS_CONTROL: Missing authority checks, signer validation
- ARITHMETIC: Integer overflow/underflow, precision loss
- ARBITRARY_CPI: Unchecked program IDs, arbitrary CPI calls
- PDA_VALIDATION: Missing PDA derivation, bump spoofing
- SIGNER_AUTH: Missing .is_signer, .owner checks
- INIT_BYPASS: Missing initialization checks, reinit
- ORACLE: Missing oracle checks, stale prices

## Output Format (JSON)
{
  "findings": [
    {
      "type": "REENTRANCY",
      "severity": "CRITICAL",
      "location": { "file": "lib.rs", "line": 42 },
      "description": "Missing reentrancy guard...",
      "cwe": "CWE-918",
      "cvss": 9.1
    }
  ],
  "poc": "// PoC exploit code here",
  "remediation": "// Fixed code here"
}

Analyze this code:
\`\`\`rust
{{CODE}}
\`\`\`
`;

export function calculateMetrics(results: EvaluationResult[]): BenchmarkMetrics {
  // TP: case is vulnerable AND agent detected it correctly
  const tp = results.filter(r => r.truePositive).length;
  // FP: agent reported findings BUT case is not vulnerable (or findings don't match)
  const fp = results.filter(r => r.falsePositive).length;
  // FN: case IS vulnerable BUT agent failed to detect it
  const fn = results.filter(r => r.isVulnerable && !r.detected).length;
  // TN: case is NOT vulnerable AND agent correctly reported nothing
  const tn = results.filter(r => !r.isVulnerable && !r.detected).length;

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;

  const avgPoc = results.reduce((a, r) => a + r.pocQuality, 0) / results.length;
  const avgRemed = results.reduce((a, r) => a + r.remediationQuality, 0) / results.length;
  const avgConf = results.reduce((a, r) => a + r.confidence, 0) / results.length;
  const avgMs = results.reduce((a, r) => a + r.elapsedMs, 0) / results.length;
  const casesPerHour = (3600000 / avgMs);

  return {
    totalCases: results.length,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    trueNegatives: tn,
    precision,
    recall,
    f1Score: f1,
    avgPocQuality: avgPoc,
    avgRemediationQuality: avgRemed,
    avgConfidence: avgConf,
    avgElapsedMs: avgMs,
    casesPerHour,
  };
}

export function matchFindings(
  agentFindings: Finding[],
  referenceVulns: string[]
): { tp: Finding[]; fp: Finding[]; missing: string[] } {
  const matched: Finding[] = [];
  const fpFindings: Finding[] = [];

  for (const afind of agentFindings) {
    const match = referenceVulns.find(rv =>
      rv.toLowerCase().includes(afind.type.toLowerCase()) ||
      rv.toLowerCase().includes(afind.description.toLowerCase().slice(0, 50))
    );
    if (match) {
      matched.push(afind);
    } else {
      fpFindings.push(afind);
    }
  }

  const matchedTypes = matched.map(m => m.type);
  const missing = referenceVulns.filter(rv =>
    !matchedTypes.some(mt => rv.toLowerCase().includes(mt.toLowerCase()))
  );

  return { tp: matched, fp: fpFindings, missing };
}

export function cvssToSeverity(cvss: number): Severity {
  if (cvss >= 9.0) return "CRITICAL";
  if (cvss >= 7.0) return "HIGH";
  if (cvss >= 4.0) return "MEDIUM";
  return "LOW";
}