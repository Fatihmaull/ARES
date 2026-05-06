import test from "node:test";
import assert from "node:assert/strict";

import { ensureWithinRoot } from "../paths";

test("ensureWithinRoot accepts files under root", () => {
  const root = "/repo";
  const candidate = "/repo/.asst/reports/a.pdf";
  assert.equal(ensureWithinRoot(root, candidate), true);
});

test("ensureWithinRoot rejects traversal outside root", () => {
  const root = "/repo";
  const candidate = "/etc/passwd";
  assert.equal(ensureWithinRoot(root, candidate), false);
});
