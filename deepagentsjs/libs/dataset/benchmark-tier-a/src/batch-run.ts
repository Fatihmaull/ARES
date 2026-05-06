/**
 * For each benchmark row with `local_project_path`, run `elite:orchestrator` on that tree.
 * Other rows are skipped (logged). Requires API keys / engine per solana-elite-auditor README.
 */
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  findDeepagentsjsRoot,
  getBenchmarkPackageDir,
  resolveProjectPath,
} from "./paths.js";
import { loadJsonl } from "./load-benchmark.js";
import type { RunManifest, BenchmarkEntry } from "./types.js";

const args = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url));
const benchmarkPackageDir = resolve(here, "..");

function getArg(name: string, def?: string): string | undefined {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return def;
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`batch-run

Options:
  --file <path>     JSONL (default: package benchmark-v1.jsonl)
  --id <prefix>     Only run ids starting with this string (e.g. SOL-BENCH-B-001)
  --out <dir>       Base results directory (default: <package>/results)
  --dry-run         Print commands only
  --list            List ids that would run (has local_project_path) and exit
`);
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const listOnly = args.includes("--list");
const idPrefix = getArg("--id", "");

let jsonl = join(benchmarkPackageDir, "benchmark-v1.jsonl");
const fArg = getArg("--file");
if (fArg) {
  jsonl = fArg.startsWith("/") ? fArg : resolve(process.cwd(), fArg);
} else {
  try {
    jsonl = join(
      findDeepagentsjsRoot(),
      "libs/dataset/benchmark-tier-a/benchmark-v1.jsonl",
    );
  } catch {
    jsonl = join(getBenchmarkPackageDir(), "benchmark-v1.jsonl");
  }
}

const outBase = getArg("--out") ?? join(benchmarkPackageDir, "results");

const runId =
  new Date().toISOString().replace(/[:.]/g, "-") +
  "-" +
  randomBytes(3).toString("hex");

function getGitCommit(root: string): string | undefined {
  try {
    const head = readFileSync(join(root, ".git", "HEAD"), "utf8").trim();
    if (head.startsWith("ref: ")) {
      const ref = head.slice(5).trim();
      return readFileSync(join(root, ".git", ref), "utf8").trim();
    }
    return head;
  } catch {
    return undefined;
  }
}

function runOrchestrator(
  monorepoRoot: string,
  projectAbs: string,
  logFile: string,
): Promise<{ code: number; durationMs: number }> {
  const t0 = Date.now();
  return new Promise((resolveP) => {
    const child = spawn(
      "pnpm",
      [
        "--dir",
        join(monorepoRoot, "examples/solana-elite-auditor"),
        "exec",
        "tsx",
        "src/run-elite-orchestrator.ts",
        projectAbs,
      ],
      {
        cwd: monorepoRoot,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stdout?.on("data", (d: Buffer) => chunks.push(d));
    child.stderr?.on("data", (d: Buffer) => errChunks.push(d));
    child.on("close", (code: number | null) => {
      const durationMs = Date.now() - t0;
      const out = Buffer.concat(chunks).toString("utf8");
      const err = Buffer.concat(errChunks).toString("utf8");
      writeFileSync(
        logFile,
        `=== stdout ===\n${out}\n\n=== stderr ===\n${err}\n`,
        "utf8",
      );
      resolveP({ code: code ?? 1, durationMs });
    });
  });
}

async function main() {
  const monorepoRoot = findDeepagentsjsRoot();
  const entries = await loadJsonl(jsonl);
  const toRun: BenchmarkEntry[] = entries.filter(
    (e) => e.local_project_path && (!idPrefix || e.id.startsWith(idPrefix)),
  );

  if (listOnly) {
    for (const e of toRun) {
      console.log(`${e.id}\t${e.local_project_path}`);
    }
    console.log(
      `\n${toRun.length} entries with local_project_path (after --id filter).`,
    );
    return;
  }

  const runDir = join(outBase, runId);
  mkdirSync(runDir, { recursive: true });

  const manifest: RunManifest = {
    runId,
    createdAt: new Date().toISOString(),
    monorepoCommit: getGitCommit(monorepoRoot),
    command: "batch-run (pnpm --dir examples/solana-elite-auditor exec tsx src/run-elite-orchestrator.ts <path>)",
    entries: [],
  };

  for (const e of entries) {
    if (!e.local_project_path) {
      manifest.entries.push({ id: e.id, path: "", status: "skipped" });
      continue;
    }
    if (idPrefix && !e.id.startsWith(idPrefix)) {
      manifest.entries.push({
        id: e.id,
        path: e.local_project_path,
        status: "skipped",
      });
      continue;
    }

    const projectAbs = resolveProjectPath(monorepoRoot, e.local_project_path);
    if (!existsSync(projectAbs)) {
      manifest.entries.push({
        id: e.id,
        path: projectAbs,
        status: "error",
        error: "project path does not exist",
      });
      continue;
    }

    const idDir = join(runDir, e.id);
    mkdirSync(idDir, { recursive: true });
    const logFile = join(idDir, "orchestrator.log");
    writeFileSync(
      join(idDir, "entry.json"),
      JSON.stringify(e, null, 2),
      "utf8",
    );

    if (dryRun) {
      console.log(`Would run orchestrator on ${projectAbs} -> ${logFile}`);
      manifest.entries.push({
        id: e.id,
        path: projectAbs,
        status: "ok",
        durationMs: 0,
      });
      continue;
    }

    const { code, durationMs } = await runOrchestrator(
      monorepoRoot,
      projectAbs,
      logFile,
    );
    manifest.entries.push({
      id: e.id,
      path: projectAbs,
      status: code === 0 ? "ok" : "error",
      durationMs,
      error: code === 0 ? undefined : `exit ${code}`,
    });
  }

  writeFileSync(
    join(runDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log(`\nWrote results under ${runDir}`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
