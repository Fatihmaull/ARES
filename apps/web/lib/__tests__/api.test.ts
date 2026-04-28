import test from "node:test";
import assert from "node:assert/strict";

import { enforceRateLimit, requireApiKey } from "../api";

test("requireApiKey allows requests in non-production when key unset", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalKey = process.env.ASST_WEB_API_KEY;
  (process.env as Record<string, string | undefined>).NODE_ENV = "development";
  delete process.env.ASST_WEB_API_KEY;

  const req = new Request("http://localhost/api/chat");
  const result = requireApiKey(req);
  assert.equal(result.ok, true);

  (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  if (originalKey === undefined) delete process.env.ASST_WEB_API_KEY;
  else process.env.ASST_WEB_API_KEY = originalKey;
});

test("requireApiKey rejects invalid key when configured", () => {
  const originalKey = process.env.ASST_WEB_API_KEY;
  process.env.ASST_WEB_API_KEY = "expected";

  const req = new Request("http://localhost/api/chat", {
    headers: { "x-api-key": "wrong" },
  });
  const result = requireApiKey(req);
  assert.equal(result.ok, false);

  if (originalKey === undefined) delete process.env.ASST_WEB_API_KEY;
  else process.env.ASST_WEB_API_KEY = originalKey;
});

test("enforceRateLimit blocks over limit", () => {
  const req = new Request("http://localhost/api/chat", {
    headers: { "x-real-ip": "127.0.0.1" },
  });
  assert.equal(enforceRateLimit(req, "r1", "test", 1).ok, true);
  assert.equal(enforceRateLimit(req, "r2", "test", 1).ok, false);
});
