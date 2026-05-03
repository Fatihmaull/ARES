#!/usr/bin/env node
/**
 * Lightweight load generator for POST /api/chat (§10 P2 gate).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 node scripts/load-test-chat.mjs
 *   CONCURRENCY=10 DURATION_SEC=30 BASE_URL=http://localhost:3000 node scripts/load-test-chat.mjs
 *
 * Optional operator bypass (no billing quota; higher route rate limit):
 *   ASST_WEB_API_KEY=... node scripts/load-test-chat.mjs
 *
 * @typedef {{ ok: boolean; status: number; ms: number; err?: string }} Result
 */

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.CONCURRENCY || "5", 10) || 5);
const DURATION_SEC = Math.max(1, Number.parseInt(process.env.DURATION_SEC || "15", 10) || 15);
const API_KEY = process.env.ASST_WEB_API_KEY?.trim();

/** @type {Result[]} */
const results = [];

async function oneRequest(seq) {
  const started = performance.now();
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  try {
    const r = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt: `load-test ping ${seq} ${Date.now()}`,
      }),
    });
    const ms = Math.round(performance.now() - started);
    results.push({ ok: r.ok, status: r.status, ms });
    if (!r.ok) {
      const t = await r.text();
      results[results.length - 1].err = t.slice(0, 120);
    }
  } catch (e) {
    const ms = Math.round(performance.now() - started);
    results.push({
      ok: false,
      status: 0,
      ms,
      err: e instanceof Error ? e.message : String(e),
    });
  }
}

async function worker(id, stopAt) {
  let n = 0;
  while (Date.now() < stopAt) {
    await oneRequest(`${id}-${n++}`);
  }
}

const stopAt = Date.now() + DURATION_SEC * 1000;
console.error(
  `[load-test-chat] BASE_URL=${BASE_URL} CONCURRENCY=${CONCURRENCY} DURATION_SEC=${DURATION_SEC} operator=${Boolean(API_KEY)}`,
);

await Promise.all(
  Array.from({ length: CONCURRENCY }, (_, i) => worker(i, stopAt)),
);

const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
const lat = results.map((r) => r.ms).sort((a, b) => a - b);
const p95 = lat[Math.floor(lat.length * 0.95)] ?? 0;

console.log(
  JSON.stringify(
    {
      totalRequests: results.length,
      success: ok,
      failed: fail,
      durationSec: DURATION_SEC,
      concurrency: CONCURRENCY,
      latencyMs: {
        min: lat[0] ?? 0,
        max: lat[lat.length - 1] ?? 0,
        p95,
      },
      sampleErrors: results
        .filter((r) => !r.ok)
        .slice(0, 5)
        .map((r) => ({ status: r.status, err: r.err })),
    },
    null,
    2,
  ),
);

if (fail > 0) process.exitCode = 1;
