import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("server exposes critical MCP tool registrations", () => {
  const src = readFileSync(resolve(process.cwd(), "src/server.ts"), "utf8");
  assert.match(src, /asst_semgrep_scan/);
  assert.match(src, /asst_merge_sarif/);
  assert.match(src, /asst_git_diff_summary/);
});
