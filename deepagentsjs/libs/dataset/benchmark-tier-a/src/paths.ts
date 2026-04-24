import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** This package: `.../deepagentsjs/libs/dataset/benchmark-tier-a` */
export function getBenchmarkPackageDir(): string {
  return resolve(here, "..");
}

/**
 * Walks up from this file to find the `deepagentsjs` monorepo root
 * (directory containing `pnpm-workspace.yaml` and `libs/dataset/benchmark-tier-a`).
 */
export function findDeepagentsjsRoot(): string {
  let d = resolve(here, "..", "..", "..", "..");
  for (let i = 0; i < 8; i++) {
    if (
      existsSync(join(d, "pnpm-workspace.yaml")) &&
      existsSync(join(d, "package.json")) &&
      existsSync(join(d, "libs", "dataset", "benchmark-tier-a", "benchmark-v1.jsonl"))
    ) {
      return d;
    }
    const p = dirname(d);
    if (p === d) break;
    d = p;
  }
  throw new Error(
    "Could not locate deepagentsjs monorepo root (expected pnpm-workspace.yaml + benchmark-v1.jsonl).",
  );
}

export function resolveProjectPath(
  monorepoRoot: string,
  rel: string,
): string {
  return resolve(monorepoRoot, rel);
}
