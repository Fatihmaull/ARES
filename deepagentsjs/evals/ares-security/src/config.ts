import type { BenchmarkConfig, CompileCheckMode, BenchmarkHarness } from "./protocol.js";
import { defaultBenchmarkConfig, isRichHarness } from "./protocol.js";

function parseHarness(v: string | undefined): BenchmarkHarness {
  const s = (v || "static").toLowerCase().replace(/-/g, "_");
  if (
    s === "static" ||
    s === "team" ||
    s === "static_rich" ||
    s === "team_rich"
  ) {
    return s as BenchmarkHarness;
  }
  return "static";
}

function parseCompile(s: string | undefined): CompileCheckMode {
  const t = (s || "off").toLowerCase();
  if (t === "off" || t === "rustfmt" || t === "anchor") return t;
  return "off";
}

/**
 * Build config from `runBenchmark` partials + process.env.
 *
 * Env:
 * - `ARES_BENCHMARK_HARNESS` — static | team | static_rich | team_rich
 * - `ARES_BENCHMARK_MAX_FEEDBACK_ROUNDS` — number (default 2)
 * - `ARES_BENCHMARK_COMPILE_CHECK` — off | rustfmt | anchor
 * - `ARES_BENCHMARK_ANCHOR_WORKSPACE` — path for anchor build
 */
export function resolveBenchmarkConfig(
  partial: Partial<BenchmarkConfig> = {}
): BenchmarkConfig {
  const envH = process.env.ARES_BENCHMARK_HARNESS;
  const envR = process.env.ARES_BENCHMARK_MAX_FEEDBACK_ROUNDS;
  const envC = process.env.ARES_BENCHMARK_COMPILE_CHECK;
  const envA = process.env.ARES_BENCHMARK_ANCHOR_WORKSPACE;

  const maxFromEnv = (() => {
    if (envR == null || envR === "") return undefined;
    const n = parseInt(envR, 10);
    return Number.isFinite(n) ? n : undefined;
  })();

  return defaultBenchmarkConfig({
    ...partial,
    harness: partial.harness ?? parseHarness(envH),
    maxFeedbackRounds: partial.maxFeedbackRounds ?? maxFromEnv,
    compileCheck: partial.compileCheck ?? parseCompile(envC),
    anchorWorkspace: partial.anchorWorkspace ?? envA,
  });
}

export { isRichHarness };
