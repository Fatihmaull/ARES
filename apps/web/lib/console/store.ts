"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ConsoleLogLevel = "info" | "warn" | "error" | "security";

export interface ConsoleLogEntry {
  id: string;
  source: string;
  level: ConsoleLogLevel;
  message: string;
  timestamp: string;
}

interface ConsoleState {
  logs: ConsoleLogEntry[];
  connected: boolean;
  lastLatencyMs: number | null;
  /**
   * ISO timestamp: SSE replay must ignore orchestrator history at or before this moment.
   * Set on Clear so Resume System does not flood the UI with old SQLite chat history.
   */
  streamReplayAfterIso: string | null;
  setConnected: (v: boolean) => void;
  addLog: (e: ConsoleLogEntry) => void;
  clear: () => void;
  setLastLatencyMs: (ms: number | null) => void;
}

export const useConsoleStore = create<ConsoleState>()(
  persist(
    (set, get) => ({
      logs: [],
      connected: false,
      lastLatencyMs: null,
      streamReplayAfterIso: null,
      setConnected: (v) => set({ connected: v }),
      addLog: (e) => {
        const prev = get().logs;
        const norm = e.message.trim();
        const src = e.source.trim();
        // Exact duplicate line (same millisecond) — rare
        if (prev.some((x) => x.timestamp === e.timestamp && x.message === e.message)) {
          return;
        }
        // `/api/chat` + SSE replay use different timestamps for the same line — collapse duplicates
        const recent = prev.slice(-100);
        if (recent.some((x) => x.source.trim() === src && x.message.trim() === norm)) {
          return;
        }
        const next = [...prev, e].slice(-600);
        set({ logs: next });
      },
      clear: () =>
        set({
          logs: [],
          lastLatencyMs: null,
          streamReplayAfterIso: new Date().toISOString(),
        }),
      setLastLatencyMs: (ms) => set({ lastLatencyMs: ms }),
    }),
    {
      name: "asst.console.v1",
      partialize: (s) => ({
        logs: s.logs,
        lastLatencyMs: s.lastLatencyMs,
        streamReplayAfterIso: s.streamReplayAfterIso,
      }),
    },
  ),
);

