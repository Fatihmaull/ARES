# ARES Security Benchmark

Elite Solana Auditor benchmark: detection + PoC + remediation scoring with **configurable harnesses** (static baseline, multi-agent team, and rich compile feedback).

## Harness modes

| Mode | Description |
|------|-------------|
| **`static`** (default) | One DeepAgent, code in → JSON out. **Use this to establish the baseline** for single-agent static analysis. |
| **`team`** | Orchestrator + **SubAgentMiddleware** roles: `analyzer` → `explorer` → `reviewer`. Coordinator has **`rustc_check`** (in-loop compiler feedback on Rust snippets). |
| **`static_rich`** | Static agent + **outer** feedback loop: after each reply, optional `rustfmt --check` on the PoC; on failure, append compiler output and re-invoke (up to `maxFeedbackRounds`). |
| **`team_rich`** | Team harness **and** the same outer `rustfmt` loop (in-tool + out-of-band feedback). |

**Future work:** keep `static` scores as the reference line; layer an **AgentFlow-style harness optimizer** on top of this eval (search over harness programs, not only prompts) to quantify lift—see `docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md` in the parent monorepo.

## Rich feedback channels

1. **In-harness (team only):** `src/tools/rustc.ts` — `rustc_check` runs `rustc --edition=2021` on a temp file. Anchor imports will error (expected); the model is nudged to care about **syntax** and structure.
2. **Outer loop (static_rich / team_rich):** `src/compile-feedback.ts` — `rustfmt --check` on the JSON `poc` string; optional `anchor` mode attempts `anchor build` if you provide a prepared workspace (see env).
3. **Full program build:** set `ARES_BENCHMARK_ANCHOR_WORKSPACE` to an Anchor repo that contains `programs/bench_eval/` — the eval can write the case `code` to `programs/bench_eval/src/lib.rs` and run `anchor build` (opt-in, slower).

## Configuration

**Environment**

| Variable | Values | Default |
|----------|--------|---------|
| `ARES_BENCHMARK_HARNESS` | `static` \| `team` \| `static_rich` \| `team_rich` | `static` |
| `ARES_BENCHMARK_COMPILE_CHECK` | `off` \| `rustfmt` \| `anchor` | `off` |
| `ARES_BENCHMARK_MAX_FEEDBACK_ROUNDS` | number | `2` |
| `ARES_BENCHMARK_ANCHOR_WORKSPACE` | path | — (only for `anchor` check) |

**CLI** (passed to `run-benchmark.ts`): `--harness=...` `--compile-check=...` `--max-feedback-rounds=N` `--max-cases=N` (smoke / subset).

## Quick start

```bash
cd evals/ares-security
pnpm install

# Baseline (single static agent) — use for score baseline
pnpm benchmark:static

# Multi-agent team + rustc tool
pnpm benchmark:team

# Baseline + rustfmt loop on PoC
pnpm benchmark:static-rich

# Team + rustfmt loop
pnpm benchmark:team-rich

# Baseline-first comparison job (runs static, then candidate harnesses)
pnpm benchmark:compare
```

Or:

```bash
ARES_BENCHMARK_HARNESS=static pnpm benchmark
ARES_BENCHMARK_HARNESS=team ARES_BENCHMARK_COMPILE_CHECK=rustfmt pnpm benchmark
ARES_BENCHMARK_MAX_CASES=25 ARES_BENCHMARK_COMPARE_HARNESSES=team,team_rich pnpm benchmark:compare
```

Comparison output is written to `./out/harness-comparison.json` and
`./out/harness-comparison.md` by default.

## Layout

```
src/
├── protocol.ts         # Types, metrics, default config
├── config.ts           # Env + resolveBenchmarkConfig
├── prompts.ts          # Static vs team orchestrator prompts
├── agents.ts           # createSecurityBenchmarkAgent (static | team + rustc)
├── tools/rustc.ts      # rustc_check tool (team / team_rich)
├── compile-feedback.ts # rustfmt / optional anchor
├── evaluate-case.ts    # One case: multi-turn rich loop + scoring
├── run-benchmark.ts    # CLI + dataset loop
├── compare-harnesses.ts # Baseline-first harness comparison + delta report
├── loader.ts
├── scorer.ts
└── report.ts
```

## Output

JSON report path from config (`outputPath`), same metrics: precision, recall, F1, PoC/remediation quality. Per-case fields may include `harness`, `feedbackRounds`, `compileLog` when using rich modes.

## Integration (programmatic)

```typescript
import { runBenchmark } from "./src/run-benchmark.js";
import { generateReport } from "./src/report.js";

const result = await runBenchmark({
  harness: "static",
  modelName: "claude-sonnet-4-20250514",
  minCvss: 7.0,
  maxCases: 5,
});
```

## Dataset

Curated cases under `../../libs/dataset/Solana_vulnerability_audit_dataset_V2/Solana.json`.

## Requirements

- **Node 20+**, **pnpm**
- For **`rustfmt` / `rustc` feedback:** Rust toolchain on `PATH` (`rustfmt`, `rustc`)
- For **Anchor** outer check: `anchor` CLI and a valid `ARES_BENCHMARK_ANCHOR_WORKSPACE` layout
