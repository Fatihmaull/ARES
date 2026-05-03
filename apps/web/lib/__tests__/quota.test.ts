import test from "node:test";
import assert from "node:assert/strict";

import { ANON_CHAT_PER_DAY } from "../billing/pricing";
import { tryConsumeAnonChatMemory } from "../billing/quota";

test("anonymous in-memory quota allows up to daily limit per IP", () => {
  const ip = "203.0.113.50";
  for (let i = 0; i < ANON_CHAT_PER_DAY; i += 1) {
    assert.equal(tryConsumeAnonChatMemory(ip), true);
  }
  assert.equal(tryConsumeAnonChatMemory(ip), false);
});

test("anonymous in-memory quota is isolated per IP", () => {
  const ipA = "203.0.113.1";
  const ipB = "203.0.113.2";
  assert.equal(tryConsumeAnonChatMemory(ipA), true);
  assert.equal(tryConsumeAnonChatMemory(ipB), true);
});
