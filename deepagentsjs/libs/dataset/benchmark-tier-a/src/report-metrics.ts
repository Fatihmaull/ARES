/**
 * Aggregate score-detail.json into Tier A / Tier B / negative-control tables
 * and write RESULTS-temp.md (override path with --out).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { indexById, loadJsonl } from "./load-benchmark.js";
import { findDeepagentsjsRoot, getBenchmarkPackageDir } from "./paths.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: pnpm report -- --run <path> [--out RESULTS.md]

Aggregates score-detail.json in the run directory (run pnpm score first).
Optional: --version <string>  agent/version label for the table header
`);
  process.exit(0);
}

function getArg(n: string): string | undefined {
  const i = args.indexOf(n);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return undefined;
}

interface Row {
  id: string;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  benchmark_tier: string;
  negative_controls: boolean;
}

function mdTable(
  title: string,
  rows: Row[],
): string {
  const lines = [
    `### ${title}`,
    "",
    "| id | tier | neg | TP | FP | FN | P | R | F1 |",
    "|----|------|-----|----|----|----|----|----|-----|",
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.id} | ${r.benchmark_tier} | ${r.negative_controls ? "Y" : ""} | ${r.tp} | ${r.fp} | ${r.fn} | ${r.precision.toFixed(2)} | ${r.recall.toFixed(2)} | ${r.f1.toFixed(2)} |`,
    );
  }
  const pAvg =
    rows.length === 0
      ? 0
      : rows.reduce((a, b) => a + b.precision, 0) / rows.length;
  const rAvg =
    rows.length === 0 ? 0 : rows.reduce((a, b) => a + b.recall, 0) / rows.length;
  lines.push("");
  lines.push(
    `**Micro-averages (naive)**: precision ${pAvg.toFixed(3)}, recall ${rAvg.toFixed(3)} (subset only; full Tier A has entries without local runs)`,
  );
  lines.push("");
  return lines.join("\n");
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
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
  const scorePath = join(runAbs, "score-detail.json");
  if (!existsSync(scorePath)) {
    console.error(
      `No score-detail.json in ${runAbs}. Run: pnpm score -- --run <same-dir>`,
    );
    process.exit(1);
  }
  const detail = JSON.parse(readFileSync(scorePath, "utf8")) as {
    byId: Record<string, Row>;
  };
  const byId = detail.byId;
  const rows = Object.values(byId);

  const version = getArg("--version") ?? "unversioned";
  const commit = getArg("--commit");

  const tierA = rows.filter(
    (r: Row) => r.benchmark_tier === "A" && !r.negative_controls,
  );
  const tierB = rows.filter((r: Row) => r.benchmark_tier === "B");
  const negs = rows.filter((r: Row) => r.negative_controls);

  let body = "";
  body += `## Solana security AI benchmark — results\n\n`;
  body += `- Run directory: \`${runAbs}\`\n`;
  body += `- Version label: ${version}\n`;
  if (commit) body += `- Monorepo/agent commit: \`${commit}\`\n`;
  body += `- Generated: ${new Date().toISOString()}\n\n`;
  body += `> Tier A and Tier B are reported **separately** per framework. `;
  body += `Heuristic matching; disputed rows require two human reviewers.\n\n`;

  body += mdTable("Tier A (non–negative, scored in this run)", tierA);
  body += mdTable("Tier B (pedagogic / PoC)", tierB);
  body += mdTable("Negative controls", negs);

  if (tierA.length) {
    body += "\n**Tier A summary (this run only)**\n\n";
    body += `- Avg P: ${mean(tierA.map((r: Row) => r.precision)).toFixed(3)}, Avg R: ${mean(tierA.map((r: Row) => r.recall)).toFixed(3)}, Avg F1: ${mean(tierA.map((r: Row) => r.f1)).toFixed(3)}\n\n`;
  }

  const outPath = getArg("--out") ?? join(runAbs, "RESULTS.md");
  writeFileSync(outPath, body, "utf8");
  console.log(`Wrote ${outPath}`);

  let jsonl = join(getBenchmarkPackageDir(), "benchmark-v1.jsonl");
  try {
    jsonl = join(
      findDeepagentsjsRoot(),
      "libs/dataset/benchmark-tier-a/benchmark-v1.jsonl",
    );
  } catch {
    /* use package dir */
  }
  if (existsSync(jsonl)) {
    const all = await loadJsonl(jsonl);
    const m = indexById(all);
    const allEntries = Array.from(m.values());
    const totalA = allEntries.filter(
      (e) => e.benchmark_tier === "A" && !e.negative_controls,
    ).length;
    const totalB = allEntries.filter((e) => e.benchmark_tier === "B")
      .length;
    const totalN = allEntries.filter((e) => e.negative_controls).length;
    console.log(
      `Dataset: Tier A (non-NC) ${totalA} rows, Tier B ${totalB} rows, negative controls ${totalN} rows (see benchmark-v1.jsonl).`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
