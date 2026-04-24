# ARES Security Benchmark

Elite Solana Auditor benchmark for evaluating AI vulnerability detection with PoC generation and remediation.

## Quick Start

```bash
cd evals/ares-security

# Run benchmark
pnpm benchmark
```

## Features

- **180 curated vulnerability cases** from Armur dataset
- **Hybrid scoring**: Detection + PoC + Remediation quality
- **Metrics**: Precision, Recall, F1, PoC Quality, Remediation Quality
- **PDF + JSON reports**

## Architecture

```
src/
├── protocol.ts      # Benchmark interface, metrics calculation
├── loader.ts      # Dataset loader + categorization
├── scorer.ts       # Hybrid scorer (detection/PoC/remediation)
├── run-benchmark.ts  # Main benchmark runner
├── report.ts      # PDF/JSON report generation
```

## Dataset

| Category | Count |
|----------|-------|
| REENTRANCY | ~25 |
| ACCESS_CONTROL | ~30 |
| ARITHMETIC | ~35 |
| ARBITRARY_CPI | ~15 |
| PDA_VALIDATION | ~15 |
| SIGNER_AUTH | ~20 |
| OTHER | ~40 |

## Output

```json
{
  "precision": 0.85,
  "recall": 0.82,
  "f1Score": 0.83,
  "avgPocQuality": 0.72,
  "avgRemediationQuality": 0.68,
  "avgConfidence": 0.81,
  "casesPerHour": 45
}
```

## Integration

Wire into existing eval-harness:

```typescript
import { runBenchmark } from "./src/run-benchmark.js";
import { generateReport } from "./src/report.js";

const result = await runBenchmark({
  modelName: "claude-sonnet-4-20250514",
  minCvss: 7.0, // Only CRITICAL/HIGH
});

const pdf = generateReport(result.metrics, result.results);
```