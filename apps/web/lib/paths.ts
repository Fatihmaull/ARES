import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export function resolveRepoRoot(): string {
  const env = process.env.ASST_REPO_ROOT?.trim();
  if (env) return resolve(env);
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }
  return resolve(cwd, "../..");
}

export function ensureWithinRoot(root: string, targetPath: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(targetPath);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${process.platform === "win32" ? "\\" : "/"}`)
  );
}
