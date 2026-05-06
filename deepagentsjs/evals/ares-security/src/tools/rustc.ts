import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execAsync = promisify(exec);

/**
 * Rich feedback tool: syntax-level Rust compile check.
 * Useful inside the team harness to validate PoC/remediation snippets.
 */
export const rustcCheckTool = new DynamicStructuredTool({
  name: "rustc_check",
  description:
    "Compile Rust code and return compiler diagnostics. Use this to validate PoC or remediation syntax.",
  schema: z.object({
    code: z.string().describe("Rust code to compile"),
  }),
  func: async ({ code }: { code: string }) => {
    const tmpFile = join(tmpdir(), `ares_check_${Date.now()}.rs`);
    writeFileSync(tmpFile, code, "utf-8");
    try {
      await execAsync(`rustc --edition=2021 --crate-type=lib -A warnings ${tmpFile}`);
      return "OK - Code compiled successfully with no syntax errors.";
    } catch (error: unknown) {
      const err = error as { stderr?: string; message?: string };
      return `Compilation Failed:\n${err.stderr || err.message || String(error)}`;
    } finally {
      try {
        unlinkSync(tmpFile);
      } catch {
        // ignore cleanup errors
      }
    }
  },
});
