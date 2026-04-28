import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { readFileTool } from "../tools/readonly.js";

test("read_file rejects out-of-root paths", async () => {
  const root = mkdtempSync(join(tmpdir(), "ares-root-"));
  const outside = mkdtempSync(join(tmpdir(), "ares-out-"));
  mkdirSync(join(root, "safe"), { recursive: true });
  writeFileSync(join(root, "safe", "ok.txt"), "hello", "utf8");
  writeFileSync(join(outside, "bad.txt"), "secret", "utf8");

  const previousRoot = process.env.ASST_REPO_ROOT;
  process.env.ASST_REPO_ROOT = root;

  const allowed = await readFileTool.invoke({ path: "safe/ok.txt" });
  assert.equal(allowed, "hello");

  const blocked = await readFileTool.invoke({ path: join(outside, "bad.txt") });
  assert.match(String(blocked), /outside repository root/);

  if (previousRoot === undefined) delete process.env.ASST_REPO_ROOT;
  else process.env.ASST_REPO_ROOT = previousRoot;
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});
