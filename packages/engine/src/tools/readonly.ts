/**
 * Read-only agent tools. Safe to mount on public surfaces (web API, MCP).
 *
 * These tools never write to the filesystem and never spawn subprocesses
 * beyond calling well-known binaries with fixed arguments (git, etc.).
 * For that class of tools (git diff, semgrep, etc.) see assurance-tools/.
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

function resolveAllowedRoot(): string {
  return process.env.ASST_REPO_ROOT
    ? resolve(process.env.ASST_REPO_ROOT)
    : resolve(process.cwd());
}

function isWithinRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`) || candidate.startsWith(`${root}\\`);
}

/**
 * Read a file from the filesystem. Always safe.
 */
export const readFileTool = tool(
  async ({ path }: { path: string }) => {
    try {
      const root = resolveAllowedRoot();
      const candidate = isAbsolute(path) ? resolve(path) : resolve(root, path);
      if (!isWithinRoot(root, candidate)) {
        return `Error reading file ${path}: path is outside repository root`;
      }
      return await fs.readFile(candidate, "utf-8");
    } catch (e: any) {
      return `Error reading file ${path}: ${e.message}`;
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file in the repository.",
    schema: z.object({ path: z.string().describe("Path to the file") }),
  },
);
