import { resolve } from "node:path";

export function resolveRepoRoot(): string {
  return process.env.ASST_REPO_ROOT
    ? resolve(process.env.ASST_REPO_ROOT)
    : resolve(process.cwd(), "../..");
}

export function ensureWithinRoot(root: string, targetPath: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedTarget = resolve(targetPath);
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${process.platform === "win32" ? "\\" : "/"}`)
  );
}
