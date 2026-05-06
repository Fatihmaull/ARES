/**
 * Helpers to build a no-op trace context, useful in tests and when the host
 * doesn't yet wire structured logging through Postgres.
 */
import type { CostClass, RunContext, Tier, TraceEvent } from "./types.js";

export interface BuildRunContextOptions {
  requestId: string;
  runId: string;
  tier?: Tier;
  budgetUnits?: number;
  allowedCostClasses?: CostClass[];
  emit?: (event: TraceEvent) => void;
  abortSignal?: AbortSignal;
}

export function buildRunContext(opts: BuildRunContextOptions): RunContext {
  return {
    requestId: opts.requestId,
    runId: opts.runId,
    budgetUnits: opts.budgetUnits ?? 100,
    allowedCostClasses: opts.allowedCostClasses ?? ["A", "B"],
    tier: opts.tier ?? "free",
    emit: opts.emit ?? (() => {}),
    abortSignal: opts.abortSignal ?? new AbortController().signal,
  };
}

export function collectingEmitter(): { emit: (event: TraceEvent) => void; events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  return {
    events,
    emit: (event) => {
      events.push(event);
    },
  };
}
