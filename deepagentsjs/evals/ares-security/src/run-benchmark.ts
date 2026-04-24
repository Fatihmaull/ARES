import { createDeepAgent } from "deepagents";
import { DEFAULT_PROMPT, type BenchmarkConfig, type EvaluationResult, type VulnerabilityCase, calculateMetrics } from "./protocol.js";
import { loadDataset, getCaseCount } from "./loader.js";
import { parseAgentResponse, scoreResponse } from "./scorer.js";

export interface BenchmarkResult {
  dataset: string;
  config: BenchmarkConfig;
  metrics: ReturnType<typeof calculateMetrics>;
  results: EvaluationResult[];
  errors: string[];
}

/**
 * Run the ARES Security Benchmark
 * 
 * 1. Loads dataset (180 cases)
 * 2. Creates DeepAgent with security skills
 * 3. Evaluates each case
 * 4. Calculates metrics
 * 5. Returns results
 */
export async function runBenchmark(config: Partial<BenchmarkConfig> = {}): Promise<BenchmarkResult> {
  const cfg: BenchmarkConfig = {
    datasetPath: "../libs/dataset/Solana_vulnerability_audit_dataset_V2/Solana.json",
    modelName: config.modelName || "claude-sonnet-4-20250514",
    temperature: config.temperature || 0.1,
    maxTokens: config.maxTokens || 4096,
    categories: config.categories || [],
    minCvss: config.minCvss || 0,
    outputPath: config.outputPath || "./ares-security-report.json",
    ...config,
  };

  console.log("Loading dataset...");
  const dataset = await loadDataset();
  const stats = getCaseCount(dataset);
  console.log(`Loaded ${stats.total} cases (${stats.vulnerable} vulnerable, ${stats.secure} secure)`);
  console.log("Categories:", stats.byCategory);
  console.log("Severity:", stats.bySeverity);

  // Create security agent
  const agent = createDeepAgent({
    name: "ares-security-auditor",
    model: cfg.modelName,
    temperature: cfg.temperature,
    maxTokens: cfg.maxTokens,
    systemPrompt: DEFAULT_PROMPT,
  });

  const results: EvaluationResult[] = [];
  const errors: string[] = [];
  let completed = 0;

  for (const testCase of dataset) {
    try {
      // Skip if filtering by category
      if (cfg.categories.length > 0 && !cfg.categories.includes(testCase.category)) {
        continue;
      }

      // Skip if below min CVSS
      if (testCase.cvss < cfg.minCvss) {
        continue;
      }

      console.log(`[${completed + 1}/${dataset.length}] Evaluating ${testCase.id} (${testCase.category})...`);

      const startTime = Date.now();

      // Run agent evaluation
      const response = await agent.execute({
        input: testCase.code,
        context: {
          testCaseId: testCase.id,
          expectedVulnerabilities: testCase.vulnerabilities,
        },
      });

      const elapsed = Date.now() - startTime;

      // Parse response and score
      const parsed = parseAgentResponse(response);
      const scored = scoreResponse(parsed, testCase);
      scored.elapsedMs = elapsed;

      results.push(scored);

      // Calculate cumulative metrics
      const metrics = calculateMetrics(results);
      console.log(`  → Detected: ${scored.detected}, TP: ${scored.truePositive}, PoC: ${scored.pocQuality.toFixed(2)}, Remed: ${scored.remediationQuality.toFixed(2)}`);
      console.log(`  → Running Precision: ${metrics.precision.toFixed(2)}, Recall: ${metrics.recall.toFixed(2)}, F1: ${metrics.f1Score.toFixed(2)}`);

      completed++;

      // Rate limit: 2 requests/sec for Claude
      await new Promise(r => setTimeout(r, 550));
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
  console.log(`F1 Score: ${finalMetrics.f1Score.toFixed(3)}`);
  console.log(`Avg PoC Quality: ${finalMetrics.avgPocQuality.toFixed(3)}`);
  console.log(`Avg Remediation Quality: ${finalMetrics.avgRemediationQuality.toFixed(3)}`);
  console.log(`Avg Confidence: ${finalMetrics.avgConfidence.toFixed(3)}`);
  console.log(`Avg Time: ${(finalMetrics.avgElapsedMs / 1000).toFixed(1)}s`);
  console.log(`Cases/Hour: ${finalMetrics.casesPerHour.toFixed(1)}`);

  return {
    dataset: cfg.datasetPath,
    config: cfg,
    metrics: finalMetrics,
    results,
    errors,
  };
}