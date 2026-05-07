"use client";

import { useEffect, useState } from "react";
import { safeResponseJson } from "@/lib/safe-response-json";

export type HealthTone = "live" | "degraded" | "offline" | "neutral";

interface HealthEnvelope {
  ok?: boolean;
  data?: {
    status?: string;
    checks?: Record<string, string>;
  };
  status?: string;
  checks?: Record<string, string>;
}

export interface HealthSnapshot {
  tone: HealthTone;
  status: string;
  checks: Record<string, string>;
  loading: boolean;
}

export function deriveTone(
  status: string | undefined | null,
  loading: boolean,
  errored: boolean,
): HealthTone {
  if (loading && !status) return "neutral";
  if (errored) return "offline";
  const s = String(status ?? "").toLowerCase();
  if (s === "ok" || s === "healthy" || s === "up") return "live";
  if (s === "degraded" || s === "warn" || s === "warning") return "degraded";
  if (s === "down" || s === "fail" || s === "error" || s === "offline")
    return "offline";
  return "neutral";
}

const FALLBACK: HealthSnapshot = {
  tone: "neutral",
  status: "unknown",
  checks: {},
  loading: true,
};

let cached: HealthSnapshot = FALLBACK;
let inflight: Promise<void> | null = null;
let lastFetched = 0;
const POLL_MS = 30_000;
const subscribers = new Set<(snap: HealthSnapshot) => void>();

function publish(snap: HealthSnapshot) {
  cached = snap;
  for (const fn of subscribers) {
    try {
      fn(snap);
    } catch {
      // ignore subscriber errors
    }
  }
}

async function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const body = await safeResponseJson<HealthEnvelope>(res);
      const payload = body?.data ?? body ?? null;
      const status = payload?.status ?? "unknown";
      const checks = payload?.checks ?? {};
      const errored = !res.ok;
      publish({
        tone: deriveTone(status, false, errored),
        status,
        checks: checks as Record<string, string>,
        loading: false,
      });
    } catch {
      publish({
        tone: "offline",
        status: "error",
        checks: {},
        loading: false,
      });
    } finally {
      lastFetched = Date.now();
      inflight = null;
    }
  })();
  return inflight;
}

export function useHealth(): HealthSnapshot {
  const [snap, setSnap] = useState<HealthSnapshot>(cached);

  useEffect(() => {
    subscribers.add(setSnap);
    if (Date.now() - lastFetched > POLL_MS) {
      void refresh();
    }
    const interval = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      subscribers.delete(setSnap);
      clearInterval(interval);
    };
  }, []);

  return snap;
}
