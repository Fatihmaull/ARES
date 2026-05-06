import { createRedis } from "@/lib/ratelimit/shared";
import { getPool } from "@/lib/db/pool";

export type CheckStatus = "ok" | "skipped" | "error";

export type DependencyChecks = {
  database: CheckStatus;
  redis: CheckStatus;
};

export async function runDependencyChecks(): Promise<{
  checks: DependencyChecks;
  errors: { database?: string; redis?: string };
}> {
  const errors: { database?: string; redis?: string } = {};
  const checks: DependencyChecks = {
    database: "skipped",
    redis: "skipped",
  };

  const pool = getPool();
  if (pool) {
    try {
      await pool.query("SELECT 1");
      checks.database = "ok";
    } catch (e) {
      checks.database = "error";
      errors.database = e instanceof Error ? e.message : String(e);
    }
  }

  const redis = createRedis();
  if (redis) {
    try {
      const pong = await redis.ping();
      checks.redis = pong === "PONG" ? "ok" : "error";
      if (checks.redis === "error") {
        errors.redis = `unexpected ping: ${String(pong)}`;
      }
    } catch (e) {
      checks.redis = "error";
      errors.redis = e instanceof Error ? e.message : String(e);
    }
  }

  return { checks, errors };
}

export function overallStatus(
  checks: DependencyChecks,
): "ok" | "degraded" {
  const required: CheckStatus[] = [];
  if (checks.database !== "skipped") required.push(checks.database);
  if (checks.redis !== "skipped") required.push(checks.redis);
  if (required.length === 0) return "ok";
  if (required.every((s) => s === "ok")) return "ok";
  return "degraded";
}
