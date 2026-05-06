import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { BenchmarkHarness, BenchmarkMetrics } from "./protocol.js";
import { runBenchmark, type BenchmarkResult } from "./run-benchmark.js";

type CandidateHarness = Exclude<BenchmarkHarness, "static">;

interface HarnessComparison {
  baseline: {
    harness: "static";
    metrics: BenchmarkMetrics;
  };
  candidates: Array<{
    harness: CandidateHarness;
    metrics: BenchmarkMetrics;
    deltaVsBaseline: {
      f1: number;
      precision: number;
      recall: number;
      avgPocQuality: number;
      avgRemediationQuality: number;
      avgConfidence: number;
      avgElapsedMs: number;
      casesPerHour: number;
    };
    errors: string[];
  }>;
}

function parseHarnesses(raw?: string): CandidateHarness[] {
  const defaults: CandidateHarness[] = ["team", "static_rich", "team_rich"];
  if (!raw?.trim()) return defaults;
  const parsed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/-/g, "_"))
    .filter(Boolean) as CandidateHarness[];
  return parsed.filter((h) =>
    ["team", "static_rich", "team_rich"].includes(h)
  );
}

function parseMaxCases(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function delta(a: number, b: number): number {
  return a - b;
}

function buildComparison(
  baseline: BenchmarkResult,
  candidates: Array<{ harness: CandidateHarness; result: BenchmarkResult }>
): HarnessComparison {
  return {
    baseline: {
      harness: "static",
      metrics: baseline.metrics,
    },
    candidates: candidates.map(({ harness, result }) => ({
      harness,
      metrics: result.metrics,
      deltaVsBaseline: {
        f1: delta(result.metrics.f1Score, baseline.metrics.f1Score),
        precision: delta(result.metrics.precision, baseline.metrics.precision),
        recall: delta(result.metrics.recall, baseline.metrics.recall),
        avgPocQuality: delta(
          result.metrics.avgPocQuality,
          baseline.metrics.avgPocQuality
        ),
        avgRemediationQuality: delta(
          result.metrics.avgRemediationQuality,
          baseline.metrics.avgRemediationQuality
        ),
        avgConfidence: delta(
          result.metrics.avgConfidence,
          baseline.metrics.avgConfidence
        ),
        avgElapsedMs: delta(
          result.metrics.avgElapsedMs,
          baseline.metrics.avgElapsedMs
        ),
        casesPerHour: delta(
          result.metrics.casesPerHour,
          baseline.metrics.casesPerHour
        ),
      },
      errors: result.errors,
    })),
  };
}

function toMarkdown(report: HarnessComparison): string {
  const lines: string[] = [];
  lines.push("# ARES Harness Comparison");
  lines.push("");
  lines.push(
    "Baseline is **static** and remains the official score reference."
  );
  lines.push("");
  lines.push("## Baseline");
  lines.push("");
  lines.push(
    `- F1: ${report.baseline.metrics.f1Score.toFixed(4)} | Precision: ${report.baseline.metrics.precision.toFixed(4)} | Recall: ${report.baseline.metrics.recall.toFixed(4)}`
  );
  lines.push(
    `- PoC: ${report.baseline.metrics.avgPocQuality.toFixed(4)} | Remediation: ${report.baseline.metrics.avgRemediationQuality.toFixed(4)} | Confidence: ${report.baseline.metrics.avgConfidence.toFixed(4)}`
  );
  lines.push("");
  lines.push("## Candidate Harnesses (delta vs static)");
  lines.push("");
  lines.push(
    "| Harness | F1 Δ | Precision Δ | Recall Δ | PoC Δ | Remediation Δ | Confidence Δ | Avg ms Δ | Cases/hr Δ |"
  );
  lines.push(
    "|--------|------:|------------:|---------:|------:|--------------:|-------------:|---------:|----------:|"
  );
  for (const c of report.candidates) {
    const d = c.deltaVsBaseline;
    lines.push(
      `| ${c.harness} | ${d.f1.toFixed(4)} | ${d.precision.toFixed(
        4
      )} | ${d.recall.toFixed(4)} | ${d.avgPocQuality.toFixed(
        4
      )} | ${d.avgRemediationQuality.toFixed(4)} | ${d.avgConfidence.toFixed(
        4
      )} | ${d.avgElapsedMs.toFixed(1)} | ${d.casesPerHour.toFixed(2)} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

export async function compareHarnesses(): Promise<HarnessComparison> {
  const maxCases = parseMaxCases(process.env.ARES_BENCHMARK_MAX_CASES);
  const modelName = process.env.ARES_BENCHMARK_MODEL;
  const candidates = parseHarnesses(process.env.ARES_BENCHMARK_COMPARE_HARNESSES);

  console.log("Running baseline harness: static");
  const baseline = await runBenchmark({
    harness: "static",
    maxCases,
    ...(modelName ? { modelName } : {}),
  });

  const candidateResults: Array<{ harness: CandidateHarness; result: BenchmarkResult }> = [];
  for (const harness of candidates) {
    console.log(`Running candidate harness: ${harness}`);
    const result = await runBenchmark({
      harness,
      maxCases,
      ...(modelName ? { modelName } : {}),
      ...(harness.includes("rich") ? { compileCheck: "rustfmt" as const } : {}),
    });
    candidateResults.push({ harness, result });
  }

  return buildComparison(baseline, candidateResults);
}

if (process.argv[1] && process.argv[1].endsWith("compare-harnesses.ts")) {
  compareHarnesses()
    .then((report) => {
      const outputDir = path.resolve(
        process.env.ARES_BENCHMARK_COMPARISON_OUT_DIR ?? "./out"
      );
      mkdirSync(outputDir, { recursive: true });
      const jsonPath = path.join(outputDir, "harness-comparison.json");
      const mdPath = path.join(outputDir, "harness-comparison.md");
      writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
      writeFileSync(mdPath, toMarkdown(report), "utf-8");
      console.log(`Wrote comparison report: ${jsonPath}`);
      console.log(`Wrote comparison summary: ${mdPath}`);
    })
    .catch((err) => {
      console.error("Harness comparison failed:", err);
      process.exitCode = 1;
    });
}
