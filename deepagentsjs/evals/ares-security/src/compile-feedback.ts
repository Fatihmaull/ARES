import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CompileCheckMode } from "./protocol.js";

export interface CompileFeedbackResult {
  ok: boolean;
  /** True when the check was not run (off, or anchor not configured). */
  skipped?: boolean;
  command?: string;
  stdout: string;
  stderr: string;
}

function tryRustfmtCheck(poc: string): CompileFeedbackResult {
  const dir = mkdtempSync(join(tmpdir(), "ares-bench-"));
  const file = join(dir, "poc.rs");
  try {
    writeFileSync(file, poc, "utf-8");
    execFileSync("rustfmt", ["--check", "--edition", "2021", file], {
      encoding: "utf-8",
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, command: "rustfmt --check", stdout: "", stderr: "" };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    const stderr = err.stderr?.toString() || err.message || String(e);
    const stdout = err.stdout?.toString() || "";
    return {
      ok: false,
      command: "rustfmt --check",
      stdout,
      stderr: stderr.slice(0, 8000),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Optional: run `anchor build` in a user-provided workspace after writing the case to
 * `programs/bench_eval/src/lib.rs`. Requires `anchor` on PATH and a valid workspace.
 */
function tryAnchorBuild(anchorWorkspace: string, programCode: string): CompileFeedbackResult {
  if (!existsSync(anchorWorkspace)) {
    return {
      ok: true,
      skipped: true,
      stdout: "",
      stderr: `anchor workspace path does not exist: ${anchorWorkspace}`,
    };
  }
  const libPath = join(anchorWorkspace, "programs", "bench_eval", "src", "lib.rs");
  if (!existsSync(join(anchorWorkspace, "programs", "bench_eval"))) {
    return {
      ok: true,
      skipped: true,
      stdout: "",
      stderr:
        "Expected programs/bench_eval/ in workspace; create it or use rustfmt mode. See README.",
    };
  }
  try {
    writeFileSync(libPath, programCode, "utf-8");
    const out = execFileSync("anchor", ["build"], {
      cwd: anchorWorkspace,
      encoding: "utf-8",
      maxBuffer: 8 * 1024 * 1024,
    });
    return { ok: true, command: "anchor build", stdout: out, stderr: "" };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer; stdout?: Buffer; message?: string };
    return {
      ok: false,
      command: "anchor build",
      stdout: err.stdout?.toString() || "",
      stderr: (err.stderr?.toString() || err.message || String(e)).slice(0, 12000),
    };
  }
}

/**
 * Rich feedback: validate PoC or full program. When `rustfmt` is not installed,
 * returns skipped so the benchmark does not loop on a missing tool.
 */
export function getCompileFeedback(
  poc: string | null,
  fullCode: string,
  mode: CompileCheckMode,
  anchorWorkspace?: string
): CompileFeedbackResult {
  if (mode === "off") {
    return { ok: true, skipped: true, stdout: "", stderr: "" };
  }

  if (mode === "rustfmt") {
    if (!poc || poc.trim().length < 8) {
      return {
        ok: false,
        stdout: "",
        stderr: "PoC is empty or too short for rustfmt --check.",
      };
    }
    // Avoid throwing if rustfmt missing
    try {
      execFileSync("rustfmt", ["--version"], { encoding: "utf-8" });
    } catch {
      return {
        ok: true,
        skipped: true,
        stdout: "",
        stderr: "rustfmt not found on PATH; install Rust toolchain or set compileCheck=off.",
      };
    }
    return tryRustfmtCheck(poc);
  }

  if (mode === "anchor") {
    if (!anchorWorkspace?.trim()) {
      return {
        ok: true,
        skipped: true,
        stdout: "",
        stderr: "compileCheck=anchor requires anchorWorkspace (or ARES_BENCHMARK_ANCHOR_WORKSPACE).",
      };
    }
    return tryAnchorBuild(anchorWorkspace, fullCode);
  }

  return { ok: true, skipped: true, stdout: "", stderr: "" };
}
