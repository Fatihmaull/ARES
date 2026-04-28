import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { getPool } from "./db.js";
import { parseWebhookBody, upsertParsedTransactions } from "./ingest.js";

const webhookSecret = process.env.WEBHOOK_SHARED_SECRET?.trim();
if (process.env.NODE_ENV === "production" && !webhookSecret) {
  throw new Error("WEBHOOK_SHARED_SECRET is required in production");
}

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

function logInfo(event: string, meta: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", event, ...meta, at: new Date().toISOString() }));
}

function logError(event: string, meta: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", event, ...meta, at: new Date().toISOString() }));
}

/**
 * Helius Enhanced / Raw webhooks POST a JSON array of transactions.
 * @see https://www.helius.dev/docs/webhooks
 */
app.post("/webhooks/helius", async (c) => {
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();
  const secret = webhookSecret;
  if (secret) {
    const auth = c.req.header("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
    const q = c.req.query("secret");
    if (bearer !== secret && q !== secret) {
      return c.json({ error: "unauthorized" }, 401);
    }
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON" }, 400);
  }

  let txs;
  try {
    txs = parseWebhookBody(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 400);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { inserted, skipped, triggersInserted, triggerCounts } =
      await upsertParsedTransactions(client, txs, "webhook");
    logInfo("webhook_ingested", {
      requestId,
      received: txs.length,
      inserted,
      skipped,
      triggersInserted,
    });
    return c.json({
      ok: true,
      requestId,
      received: txs.length,
      inserted,
      skipped_duplicates: skipped,
      triggers: {
        inserted: triggersInserted,
        counts: triggerCounts,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("webhook_ingest_failed", { requestId, message });
    return c.json({ error: "internal error", requestId }, 500);
  } finally {
    client.release();
  }
});

const port = Number(process.env.PORT ?? "8787");
serve({ fetch: app.fetch, port });
logInfo("server_started", { port, endpoint: "/webhooks/helius" });
