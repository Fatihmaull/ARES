import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBenchmarkConfig } from "./config.js";
import { createSecurityBenchmarkAgent } from "./agents.js";
import { evaluateCase } from "./evaluate-case.js";
import {
  type BenchmarkConfig,
  type EvaluationResult,
  calculateMetrics,
} from "./protocol.js";
import { loadDataset, getCaseCount } from "./loader.js";

export interface BenchmarkResult {
  dataset: string;
  config: BenchmarkConfig;
  metrics: ReturnType<typeof calculateMetrics>;
  results: EvaluationResult[];
  errors: string[];
}

function parseCliArgs(): Partial<BenchmarkConfig> & { maxCases?: number } {
  const out: Partial<BenchmarkConfig> & { maxCases?: number } = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--harness=")) {
      out.harness = a.slice("--harness=".length) as BenchmarkConfig["harness"];
    } else if (a.startsWith("--compile-check=")) {
      out.compileCheck = a.slice(
        "--compile-check=".length
      ) as BenchmarkConfig["compileCheck"];
    } else if (a.startsWith("--max-feedback-rounds=")) {
      out.maxFeedbackRounds = parseInt(
        a.slice("--max-feedback-rounds=".length),
        10
      );
    } else if (a.startsWith("--max-cases=")) {
      out.maxCases = parseInt(a.slice("--max-cases=".length), 10);
    }
  }
  return out;
}

/**
 * ARES Security benchmark — static baseline, team harness, and/or rich compile feedback.
 * Env: `ARES_BENCHMARK_*` (see `src/config.ts`). CLI overrides env for quick runs.
 */
export type RunBenchmarkInput = Partial<BenchmarkConfig> & { maxCases?: number };

export async function runBenchmark(config: RunBenchmarkInput = {}): Promise<BenchmarkResult> {
  const { maxCases, ...rest } = config;
  const cfg = resolveBenchmarkConfig(rest);

  console.log("ARES eval harness:", cfg.harness);
  console.log(
    "  compileCheck:",
    cfg.compileCheck,
    "| maxFeedbackRounds:",
    cfg.maxFeedbackRounds
  );

  console.log("Loading dataset...");
  const dataset = await loadDataset();
  const stats = getCaseCount(dataset);
  console.log(
    `Loaded ${stats.total} cases (${stats.vulnerable} vulnerable, ${stats.secure} secure)`
  );
  console.log("Categories:", stats.byCategory);
  console.log("Severity:", stats.bySeverity);

  const agent = createSecurityBenchmarkAgent(cfg);

  const results: EvaluationResult[] = [];
  const errors: string[] = [];
  let completed = 0;

  for (const testCase of dataset) {
    if (maxCases != null && maxCases > 0 && results.length >= maxCases) {
      break;
    }
    try {
      if (cfg.categories.length > 0 && !cfg.categories.includes(testCase.category)) {
        continue;
      }
      if (testCase.cvss < cfg.minCvss) {
        continue;
      }

      console.log(
        `[${completed + 1}/${dataset.length}] ${testCase.id} (${testCase.category}) [${cfg.harness}]...`
      );

      const { result } = await evaluateCase(testCase, agent, cfg);

      results.push(result);

      const metrics = calculateMetrics(results);
      console.log(
        `  → Detected: ${result.detected}, TP: ${result.truePositive}, PoC: ${result.pocQuality.toFixed(2)}, ` +
          `Remed: ${result.remediationQuality.toFixed(2)}` +
          (result.feedbackRounds
            ? `, feedbackRounds: ${result.feedbackRounds}`
            : "")
      );
      console.log(
        `  → Precision: ${metrics.precision.toFixed(2)}, Recall: ${metrics.recall.toFixed(2)}, F1: ${metrics.f1Score.toFixed(2)}`
      );

      completed += 1;
      await new Promise((r) => setTimeout(r, 550));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error on ${testCase.id}: ${msg}`);
      errors.push(`${testCase.id}: ${msg}`);
    }
  }

  const finalMetrics = calculateMetrics(results);
  console.log("\n=== FINAL RESULTS ===");
  console.log(`Precision: ${finalMetrics.precision.toFixed(3)}`);
  console.log(`Recall: ${finalMetrics.recall.toFixed(3)}`);
  console.log(`F1: ${finalMetrics.f1Score.toFixed(3)}`);
  console.log(`Avg PoC: ${finalMetrics.avgPocQuality.toFixed(3)}`);
  console.log(`Avg Remediation: ${finalMetrics.avgRemediationQuality.toFixed(3)}`);
  console.log(`Cases/Hour: ${finalMetrics.casesPerHour.toFixed(1)}`);

  return {
    dataset: cfg.datasetPath,
    config: cfg,
    metrics: finalMetrics,
    results,
    errors,
  };
}

const isMain =
  process.argv[1] &&
  path.normalize(fileURLToPath(import.meta.url)) ===
    path.normalize(path.resolve(process.argv[1]));

if (isMain) {
  const cli = parseCliArgs();
  runBenchmark(cli as RunBenchmarkInput).catch(console.error);
}
