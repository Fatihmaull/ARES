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
      setConnected: (v) => set({ connected: v }),
      addLog: (e) => {
        const prev = get().logs;
        // De-dupe by same timestamp+message
        if (prev.some((x) => x.timestamp === e.timestamp && x.message === e.message)) {
          return;
        }
        const next = [...prev, e].slice(-600);
        set({ logs: next });
      },
      clear: () => set({ logs: [], lastLatencyMs: null }),
      setLastLatencyMs: (ms) => set({ lastLatencyMs: ms }),
    }),
    {
      name: "asst.console.v1",
      partialize: (s) => ({ logs: s.logs, lastLatencyMs: s.lastLatencyMs }),
    },
  ),
);

