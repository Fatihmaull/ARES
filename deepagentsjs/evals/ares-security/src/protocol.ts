import type { ChatCompletion } from "openai";

/**
 * ARES Security Benchmark Protocol
 * 
 * Evaluates AI agents on Solana vulnerability detection with:
 * - Detection accuracy (TP/FP/FN)
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

export interface BenchmarkConfig {
  datasetPath: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  categories: VulnerabilityCategory[];
  minCvss: number;
  outputPath: string;
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
  const tp = results.filter(r => r.truePositive).length;
  const fp = results.filter(r => r.falsePositive).length;
  const fn = results.filter(r => r.truePositive && !r.detected).length;
  const tn = results.filter(r => !r.truePositive && !r.detected).length;

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