/**
 * Score a batch run: load orchestrator.log per id, match agent output to ground truth G.
 * Writes score-detail.json in the run directory.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findDeepagentsjsRoot, getBenchmarkPackageDir } from "./paths.js";
import { indexById, loadJsonl } from "./load-benchmark.js";
import {
  estimateFpCount,
  matchGroundTruth,
  reportImpliesVulnerability,
  scoreNegativeControl,
} from "./match-findings.js";
import type { BenchmarkEntry } from "./types.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: pnpm score -- --run <path-to-results/TIMESTAMP-id>

Options:
  --file <jsonl>   benchmark file (default: package benchmark-v1.jsonl)
  --run <dir>      directory containing manifest.json and per-id subfolders
`);
  process.exit(0);
}

function getArg(n: string): string | undefined {
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return undefined;
}

function readStdoutFromLog(logPath: string): string {
  if (!existsSync(logPath)) return "";
  const raw = readFileSync(logPath, "utf8");
  const m = raw.split("=== stdout ===");
  if (m[1]) {
    return m[1]!.split("=== stderr ===")[0]!.trim() || raw;
  }
  return raw;
}

async function main() {
  const runDir = getArg("--run");
  if (!runDir) {
    console.error("Missing --run <directory>");
    process.exit(1);
  }
  const runPath = runDir;
  const runAbs = runPath.startsWith("/")
    ? runPath
    : resolve(process.cwd(), runPath);

  let jsonl = join(getBenchmarkPackageDir(), "benchmark-v1.jsonl");
  const jf = getArg("--file");
  if (jf) {
    jsonl = jf.startsWith("/") ? jf : resolve(process.cwd(), jf);
  } else {
    try {
      jsonl = join(
        findDeepagentsjsRoot(),
        "libs/dataset/benchmark-tier-a/benchmark-v1.jsonl",
      );
    } catch {
      // keep default
    }
  }

  const entries = await loadJsonl(jsonl);
  const byId = indexById(entries);

  const scores: Record<
    string,
    {
      id: string;
      tp: number;
      fp: number;
      fn: number;
      precision: number;
      recall: number;
      f1: number;
      negative_controls: boolean;
      benchmark_tier: string;
      nc_fp_signal?: number;
    }
  > = {};

  const subdirs = existsSync(runAbs)
    ? readdirSync(runAbs, { withFileTypes: true })
        .filter(
          (d: import("node:fs").Dirent) => d.isDirectory() && d.name !== "node_modules",
        )
        .map((d: import("node:fs").Dirent) => d.name)
    : [];

  for (const id of subdirs) {
    const e = byId.get(id) as BenchmarkEntry | undefined;
    if (!e) continue;
    const logPath = join(runAbs, id, "orchestrator.log");
    const text = readStdoutFromLog(logPath);
    if (!text.trim()) continue;

    if (e.negative_controls) {
      const nc = scoreNegativeControl(e, text);
      scores[id] = {
        id,
        tp: 0,
        fp: nc.fp ?? 0,
        fn: 0,
        precision: nc.fp ? 0 : 1,
        recall: 1,
        f1: nc.fp ? 0 : 1,
        negative_controls: true,
        benchmark_tier: e.benchmark_tier,
        nc_fp_signal: reportImpliesVulnerability(text) ? 1 : 0,
      };
      continue;
    }

    const G = e.ground_truth_findings;
    const m = matchGroundTruth(text, G, {});
    const fp = estimateFpCount(m.fpCandidates);
    const tp = m.tp;
    const fn = m.fn;
    const prec = tp + fp === 0 ? 0 : tp / (tp + fp);
    const rec = tp + fn === 0 ? 0 : tp / (tp + fn);
    const f1 =
      prec + rec === 0 ? 0 : (2 * prec * rec) / (prec + rec);

    scores[id] = {
      id,
      tp,
      fp,
      fn,
      precision: prec,
      recall: rec,
      f1,
      negative_controls: false,
      benchmark_tier: e.benchmark_tier,
    };
  }

  const outPath = join(runAbs, "score-detail.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      { run: runAbs, sourceJsonl: jsonl, byId: scores, note: "Heuristic scores; dispute via dual human review per framework §5" },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Scored ${Object.keys(scores).length} result folders with logs.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
