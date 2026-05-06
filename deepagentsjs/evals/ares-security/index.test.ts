import { describe, it, expect } from "vitest";
import { loadDataset, getCaseCount } from "./src/loader.js";
import { calculateMetrics } from "./src/protocol.js";
import { parseAgentResponse, scoreResponse } from "./src/scorer.js";

describe("ARES Security Benchmark", () => {
  it("should load dataset", async () => {
    const dataset = await loadDataset();
    expect(dataset.length).toBeGreaterThan(0);
    
    const stats = getCaseCount(dataset);
    console.log("Dataset stats:", stats);
    expect(stats.total).toBeGreaterThan(0);
  });

  it("should parse agent JSON response", () => {
    const raw = JSON.stringify({
      findings: [
        {
          type: "REENTRANCY",
          severity: "CRITICAL",
          location: { file: "lib.rs", line: 42 },
          description: "Missing reentrancy guard",
          cwe: "CWE-918",
          cvss: 9.1,
        },
      ],
      poc: "token::transfer(...)",
      remediation: "require!(...);",
    });

    const parsed = parseAgentResponse(raw);
    expect(parsed.findings.length).toBe(1);
    expect(parsed.findings[0].type).toBe("REENTRANCY");
    expect(parsed.poc).toBeTruthy();
  });

  it("should score detection correctly", async () => {
    const dataset = await loadDataset();
    const vulnerable = dataset.filter(d => d.vulnerabilities.length > 0);
    
    // Simulate a true positive response with a general vulnerability type
    // that should match the reference vulnerabilities
    const mockResponse = {
      findings: [
        {
          type: "ACCESS_CONTROL" as const, // Common category
          severity: "CRITICAL" as const,
          location: { file: "lib.rs", line: 1 },
          description: "Missing access control on admin function",
          cwe: "CWE-284",
          cvss: 9.0,
        },
      ],
      poc: "invoke(...)",
      remediation: "require!(...)",
      rawResponse: "",
    };

    const result = scoreResponse(mockResponse, vulnerable[0]);
    // Detection should work - truePositive depends on match with reference
    expect(result.detected).toBe(true);
    // Score should be calculated
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should calculate metrics", () => {
    const mockResults = [
      {
        caseId: "001",
        detected: true,
        isVulnerable: true,
        severity: "CRITICAL",
        truePositive: true,
        falsePositive: false,
        confidence: 1.0,
        poc: "test",
        pocQuality: 0.8,
        remediation: "test",
        remediationQuality: 0.7,
        elapsedMs: 1000,
        findings: [],
      },
      {
        caseId: "002",
        detected: false,
        isVulnerable: true,
        severity: null,
        truePositive: false,
        falsePositive: false,
        confidence: 0.0,
        poc: null,
        pocQuality: 0.0,
        remediation: null,
        remediationQuality: 0.0,
        elapsedMs: 1000,
        findings: [],
      },
      {
        caseId: "003",
        detected: true,
        isVulnerable: true,
        severity: "HIGH",
        truePositive: true,
        falsePositive: false,
        confidence: 0.5,
        poc: "test",
        pocQuality: 0.6,
        remediation: "test",
        remediationQuality: 0.5,
        elapsedMs: 1000,
        findings: [],
      },
    ];

    const metrics = calculateMetrics(mockResults as any);
    expect(metrics.precision).toBe(1.0);
    expect(metrics.recall).toBeGreaterThan(0);
    expect(metrics.f1Score).toBeGreaterThan(0);
  });
});

describe("Dataset Analysis", () => {
  it("should show category distribution", async () => {
    const dataset = await loadDataset();
    const stats = getCaseCount(dataset);
    
    console.log("\n=== Category Distribution ===");
    for (const [cat, count] of Object.entries(stats.byCategory)) {
      console.log(`  ${cat}: ${count}`);
    }

    console.log("\n=== Severity Distribution ===");
    for (const [sev, count] of Object.entries(stats.bySeverity)) {
      console.log(`  ${sev}: ${count}`);
    }
    
    expect(stats.total).toBe(180);
    expect(stats.vulnerable).toBeGreaterThan(stats.secure);
  });
});