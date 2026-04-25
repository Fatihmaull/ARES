import type { EvaluationResult, Finding, VulnerabilityCase } from "./protocol.js";

/**
 * Hybrid Scorer: Detection + PoC + Remediation Evaluation
 * 
 * Evaluates agent responses across three dimensions:
 * 1. Vulnerability detection (TP/FP/FN)
 * 2. PoC quality (exploit clarity, realism)
 * 3. Remediation quality ( correctness, completeness)
 */

export interface HybridScore {
  detection: DetectionScore;
  poc: PocScore;
  remediation: RemediationScore;
  overall: number;
}

export interface DetectionScore {
  truePositive: boolean;
  falsePositive: boolean;
  confidence: number;
  matchedTypes: string[];
  missedTypes: string[];
}

export interface PocScore {
  quality: number; // 0-1
  hasExploit: boolean;
  hasCallChain: boolean;
  hasExpectedValues: boolean;
}

export interface RemediationScore {
  quality: number; // 0-1
  hasGuard: boolean;
  hasValidation: boolean;
  hasErrorHandling: boolean;
}

export interface AgentResponse {
  findings: Finding[];
  poc: string | null;
  remediation: string | null;
  rawResponse: string;
}

/**
 * Score vulnerability detection
 */
export function scoreDetection(
  response: AgentResponse,
  reference: VulnerabilityCase
): DetectionScore {
  const refVulns = reference.vulnerabilities.map(v => v.toLowerCase());
  const refCategory = reference.category.toLowerCase();

  // Match detected to reference
  const matched: string[] = [];
  const missed: string[] = [];

  for (const ref of refVulns) {
    const found = response.findings.find(f => {
      const type = f.type.toLowerCase();
      const desc = f.description.toLowerCase();

      // Explicit category match
      if (type === refCategory && type !== "other") return true;
      // Type mentioned in reference text
      if (ref.includes(type) && type !== "other") return true;
      
      // Token overlap heuristic for description matching
      const refTokens = ref.split(/\\W+/).filter(t => t.length > 3);
      const matchedTokens = refTokens.filter(t => desc.includes(t));
      return refTokens.length > 0 && matchedTokens.length >= refTokens.length * 0.5;
    });

    if (found) {
      matched.push(found.type);
    } else {
      missed.push(ref);
    }
  }

  const truePositive = matched.length > 0;
  const falsePositive = response.findings.length > 0 && matched.length === 0;
  const confidence = matched.length / Math.max(refVulns.length, 1);

  return {
    truePositive,
    falsePositive,
    confidence,
    matchedTypes: matched,
    missedTypes: missed,
  };
}

/**
 * Score PoC quality
 */
export function scorePoc(
  response: AgentResponse,
  _reference: VulnerabilityCase
): PocScore {
  const poc = response.poc || "";

  // Check for exploit elements
  const hasExploit = /invoke|transfer|borrow|withdraw|call/i.test(poc);
  const hasCallChain = /ctx\.accounts|Signer|Program/i.test(poc);
  const hasExpectedValues = /\d+\s*\*|amount|lamports|with/i.test(poc);

  // Quality heuristics
  let quality = 0;
  if (hasExploit) quality += 0.3;
  if (hasCallChain) quality += 0.4;
  if (hasExpectedValues) quality += 0.3;

  return {
    quality: Math.min(quality, 1),
    hasExploit,
    hasCallChain,
    hasExpectedValues,
  };
}

/**
 * Score remediation quality
 */
export function scoreRemediation(
  response: AgentResponse,
  reference: VulnerabilityCase
): RemediationScore {
  const remediation = response.remediation || "";
  const refVulns = reference.vulnerabilities.join(" ").toLowerCase();

  // Check for specific fixes
  const hasGuard = /require!|invoke|emit|CpiContext/i.test(remediation);
  const hasValidation = /owner|is_signer|signer|validate/i.test(remediation);
  const hasErrorHandling = /ok_or|unwrap|checked/i.test(remediation);

  // Additional heuristics based on reference vulnerability types
  let quality = 0;
  if (refVulns.includes("reentran") && /invoke/i.test(remediation)) quality += 0.4;
  else if (refVulns.includes("reentran")) quality += 0.2;

  if (refVulns.includes("access") && /signer|authority/i.test(remediation)) quality += 0.3;
  else if (refVulns.includes("access")) quality += 0.1;

  if (refVulns.includes("overflow") && /checked/i.test(remediation)) quality += 0.3;
  else if (refVulns.includes("overflow")) quality += 0.1;

  quality += hasGuard ? 0.2 : 0;
  quality += hasValidation ? 0.2 : 0;
  quality += hasErrorHandling ? 0.1 : 0;
  quality = Math.min(quality, 1);

  return {
    quality,
    hasGuard,
    hasValidation,
    hasErrorHandling,
  };
}

/**
 * Score a single response
 */
export function scoreResponse(
  response: AgentResponse,
  reference: VulnerabilityCase
): EvaluationResult {
  const start = Date.now();

  const detection = scoreDetection(response, reference);
  const poc = scorePoc(response, reference);
  const remediation = scoreRemediation(response, reference);

  return {
    caseId: reference.id,
    detected: response.findings.length > 0,
    isVulnerable: reference.vulnerabilities.length > 0,
    severity: response.findings[0]?.severity || null,
    truePositive: detection.truePositive,
    falsePositive: detection.falsePositive,
    confidence: detection.confidence,
    poc: response.poc,
    pocQuality: poc.quality,
    remediation: response.remediation,
    remediationQuality: remediation.quality,
    elapsedMs: Date.now() - start,
    findings: response.findings,
  };
}

/**
 * Parse agent JSON response into structured format
 */
export function parseAgentResponse(raw: string): AgentResponse {
  const findings: Finding[] = [];
  let poc: string | null = null;
  let remediation: string | null = null;

  try {
    const json = JSON.parse(raw);

    if (json.findings) {
      for (const f of json.findings) {
        findings.push({
          type: f.type || "OTHER",
          severity: f.severity || "MEDIUM",
          location: f.location || { file: "lib.rs", line: 0 },
          description: f.description || "",
          cwe: f.cwe || "CWE-000",
          cvss: f.cvss || 5.0,
        });
      }
    }

    poc = json.poc || null;
    remediation = json.remediation || null;
  } catch {
    // Failed to parse JSON, store raw
    poc = raw.slice(0, 500);
  }

  return { findings, poc, remediation, rawResponse: raw };
}