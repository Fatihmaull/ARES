import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { initSentry, createLogger, captureException } from "@ares/observability";
import { startWorker } from "@ares/queue";

import { closePool } from "./db.js";
import { dispatchJob } from "./handlers.js";
import { validateWaveASkills } from "./waveA.js";

const log = createLogger({ service: "ares-worker" });

function workerRepoRoot(): string {
  const env = process.env.ASST_REPO_ROOT?.trim();
  if (env) return resolve(env);
  const cwd = resolve(process.cwd());
  if (existsSync(join(cwd, "pnpm-workspace.yaml"))) {
    return cwd;
  }
  return resolve(cwd, "../..");
}

async function main(): Promise<void> {
  await initSentry({ serviceName: "ares-worker" });

  const repoRoot = workerRepoRoot();
  validateWaveASkills(repoRoot);

  const concurrency = Number.parseInt(process.env.ASST_WORKER_CONCURRENCY ?? "4", 10) || 4;
  const handle = await startWorker({
    concurrency,
    handler: async (payload, meta) => {
      try {
        await dispatchJob(payload, meta);
      } catch (err) {
        await captureException(err, { runId: payload.runId, kind: payload.kind });
        throw err;
      }
    },
  });

  const port = Number.parseInt(process.env.ASST_WORKER_HEALTH_PORT ?? "9090", 10) || 9090;
  const health = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/healthz") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ts: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  health.listen(port, () => {
    log.info({ concurrency, port }, "ares-worker up");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, "ares-worker draining");
    try {
      await handle.close();
      await closePool();
    } finally {
      health.close(() => {
        process.exit(0);
      });
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch(async (err) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, "ares-worker fatal");
  await captureException(err);
  process.exit(1);
});
