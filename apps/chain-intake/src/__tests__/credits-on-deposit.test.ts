import test from "node:test";
import assert from "node:assert/strict";

import { findAsstMemoInTx, parseAsstMemo } from "../credits-on-deposit.js";

test("parseAsstMemo parses memo fields", () => {
  const m = parseAsstMemo("ASST:Wallet111:starter:nonce-abc");
  assert.deepEqual(m, {
    userWallet: "Wallet111",
    bundleId: "starter",
    clientNonce: "nonce-abc",
  });
});

test("parseAsstMemo returns null on garbage", () => {
  assert.equal(parseAsstMemo("hello"), null);
});

test("findAsstMemoInTx finds memo nested in JSON-like blob", () => {
  const tx = {
    meta: {
      logMessages: ['ignored', 'memo ASST:Wallet222:growth:n1extra'],
    },
  };
  const memo = findAsstMemoInTx(tx);
  assert.ok(memo?.startsWith("ASST:"));
  assert.ok(memo?.includes("Wallet222"));
});
