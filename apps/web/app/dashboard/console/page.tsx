"use client";

import {
  Activity,
  ChevronRight,
  Cpu,
  Lock,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Square,
  Terminal as TerminalIcon,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { safeResponseJson } from "@/lib/safe-response-json";
import { useConsoleStore } from "@/lib/console/store";

type RunDto = {
  id: string;
  kind: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  createdAt: string;
};

export default function ConsolePage() {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [sending, setSending] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [runCounts, setRunCounts] = useState<{ queued: number; running: number }>({
    queued: 0,
    running: 0,
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  const logs = useConsoleStore((s) => s.logs);
  const addLog = useConsoleStore((s) => s.addLog);
  const clear = useConsoleStore((s) => s.clear);
  const connected = useConsoleStore((s) => s.connected);
  const setConnected = useConsoleStore((s) => s.setConnected);
  const lastLatencyMs = useConsoleStore((s) => s.lastLatencyMs);
  const setLastLatencyMs = useConsoleStore((s) => s.setLastLatencyMs);

  const loadVitals = useCallback(async () => {
    try {
      const [healthRes, runsRes] = await Promise.all([
        fetch("/api/health", { cache: "no-store" }),
        fetch("/api/runs?limit=100", { cache: "no-store" }),
      ]);
      const healthBody = await safeResponseJson<any>(healthRes);
      const runsBody = await safeResponseJson<{ ok?: boolean; data?: { runs?: RunDto[] } }>(
        runsRes,
      );
      setHealth(healthBody?.data ?? healthBody ?? null);
      const runs = runsBody?.data?.runs ?? [];
      setRunCounts({
        queued: runs.filter((r) => r.status === "queued").length,
        running: runs.filter((r) => r.status === "running").length,
      });
    } catch {
      // best-effort
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    void loadVitals();
    const t = setInterval(() => void loadVitals(), 10_000);
    return () => clearInterval(t);
  }, [loadVitals]);

  useEffect(() => {
    if (!streamEnabled) {
      setConnected(false);
      return;
    }

    let intentionalClose = false;
    const eventSource = new EventSource("/api/console/stream");
    setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          id?: string;
          source?: string;
          level?: "info" | "warn" | "error" | "security";
          message?: string;
          timestamp?: string;
        };
        if (data.type === "log" && data.message && data.timestamp) {
          addLog({
            id: data.id ?? `${data.timestamp}:${data.message.slice(0, 32)}`,
            source: data.source ?? "ARES",
            level: data.level ?? "info",
            message: data.message,
            timestamp: data.timestamp,
          });
          setLoading(false);
        }
      } catch {
        /* ignore malformed chunks */
      }
    };

    eventSource.onerror = () => {
      if (intentionalClose) return;
      setConnected(false);
      eventSource.close();
      setLoading(false);
    };

    return () => {
      intentionalClose = true;
      eventSource.close();
      setConnected(false);
    };
  }, [streamEnabled, addLog, setConnected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    addLog({
      id: `${Date.now()}`,
      source: "Operator",
      level: "info",
      message: inputValue,
      timestamp: new Date().toISOString(),
    });
    const cmd = inputValue;
    setInputValue("");

    try {
      setSending(true);
      const t0 = performance.now();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: cmd }),
      });
      const t1 = performance.now();
      setLastLatencyMs(Math.round(t1 - t0));

      const data = await safeResponseJson<any>(res);
      const responseMessage = data?.data?.response || data?.response || "No response.";

      addLog({
        id: `${Date.now() + 1}`,
        source: "ARES",
        level: res.ok ? "security" : "error",
        message: responseMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      addLog({
        id: `${Date.now() + 1}`,
        source: "System",
        level: "error",
        message: err instanceof Error ? err.message : "Failed to reach /api/chat.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  const bufferUsage = useMemo(() => {
    const chars = logs.reduce((acc, l) => acc + l.message.length, 0);
    const pct = Math.max(0, Math.min(100, Math.round((chars / 20000) * 100)));
    return { chars, pct };
  }, [logs]);

  const memoryMap = useMemo(() => {
    const text = logs.slice(-40).map((l) => l.message).join(" ");
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9_ -]/g, " ")
      .split(/\s+/)
      .filter(
        (t) =>
          t.length >= 5 &&
          !["which", "there", "their", "about", "would", "could"].includes(t),
      );
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([w, c]) => ({ w, c }));
  }, [logs]);

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">Runtime Execution</p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">Operator Console</h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A real-time telemetry stream from the autonomous analysis engine. 
            Direct interaction with agent logical reasoning buffers.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setStreamEnabled(false)}
            className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-[14px] font-medium hover:bg-muted transition-all ring-shadow"
          >
            <Square className="w-4 h-4" />
            Terminate All
          </button>
          <button
            type="button"
            onClick={() => setStreamEnabled(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[14px] font-medium hover:opacity-90 transition-all shadow-xl shadow-primary/20"
          >
            <Play className="w-4 h-4" />
            Resume System
          </button>
          <button
            type="button"
            onClick={() => clear()}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-[14px] font-medium hover:bg-secondary/50 transition-all"
            title="Clear console history (local only)"
          >
            <RefreshCw className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 flex-1 min-h-[600px]">
        {/* Main Terminal View */}
        <div className="lg:col-span-3 flex flex-col h-full overflow-hidden whisper-shadow">
           <div className="bg-[#141413] border border-[#30302e] rounded-2xl flex flex-col h-full overflow-hidden">
              {/* Terminal Header */}
              <div className="px-6 py-4 border-b border-[#30302e] bg-[#1a1a18] flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs font-mono text-warm-silver font-bold uppercase tracking-widest text-[#b0aea5]">ASST: Autonomous Shell</span>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#87867f] uppercase tracking-tighter">
                       <span
                         className={cn(
                           "w-2 h-2 rounded-full",
                           connected ? "bg-emerald-500 animate-pulse" : "bg-amber-500",
                         )}
                       />
                       {connected ? "Synchronized" : "Disconnected"}
                    </div>
                    <div className="h-4 w-px bg-[#30302e]" />
                    <button className="text-[#87867f] hover:text-[#faf9f5] transition-colors p-1">
                       <ChevronRight className="w-4 h-4 rotate-90" />
                    </button>
                 </div>
              </div>

               {/* Logs Stream */}
               <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-[14px]">
                  {loading && (
                    <div className="flex gap-4 opacity-50">
                       <span className="text-[#5e5d59] shrink-0 w-24">[......]</span>
                       <span className="text-primary animate-pulse">Initializing logical buffer...</span>
                    </div>
                  )}
                  {mounted && logs.map((log) => (
                    <div key={log.id} className="flex gap-4 group border-l border-transparent hover:border-primary/20 pl-2 transition-all">
                       <span className="text-[#5e5d59] shrink-0 w-24">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                       <span className={cn(
                         "shrink-0 w-32 font-bold px-2 rounded",
                         log.level === 'info' ? "text-blue-400 bg-blue-400/5" : 
                         log.level === 'warn' ? "text-amber-400 bg-amber-400/5" : 
                         log.level === 'security' ? "text-emerald-400 bg-emerald-400/5" : "text-rose-400 bg-rose-400/5"
                       )}>&gt; {log.source.toUpperCase()}</span>
                       <span className="text-[#faf9f5] leading-relaxed break-words flex-1">{log.message}</span>
                    </div>
                  ))}
                  <form onSubmit={handleCommand} className="flex gap-4">
                     <span className="text-primary animate-pulse shrink-0 w-24 border-r border-[#30302e] inline-block">_</span>
                     <input 
                       type="text"
                       value={inputValue}
                       onChange={(e) => setInputValue(e.target.value)}
                       placeholder="Type a prompt and press Enter…" 
                       className="bg-transparent border-none p-0 focus:ring-0 text-[#faf9f5] w-full placeholder:text-[#5e5d59] mt-[-2px]" 
                     />
                  </form>
                  {sending && (
                    <div className="flex gap-4 opacity-70">
                       <span className="text-[#5e5d59] shrink-0 w-24">[......]</span>
                       <span className="text-primary animate-pulse">thinking…</span>
                    </div>
                  )}
                  <div ref={bottomRef} />
               </div>

              {/* Footer status */}
              <div className="px-6 py-3 border-t border-[#30302e] bg-[#1a1a18] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[#5e5d59]">
                 <div className="flex items-center gap-6">
                    <span>QUEUE: {runCounts.queued + runCounts.running}</span>
                    <span>RUNNING: {runCounts.running}</span>
                    <span>LAT: {lastLatencyMs ?? "—"}ms</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    {health?.status ? `Health: ${health.status}` : "Health: —"}
                 </div>
              </div>
           </div>
        </div>

        {/* Console Side Panel - System Context */}
        <div className="space-y-6">
           <div className="ares-card p-6 bg-secondary/10 whisper-shadow">
              <h3 className="text-lg font-serif font-medium mb-6 flex items-center gap-2">
                 <Zap className="w-4 h-4 text-primary" />
                 Active Buffers
              </h3>
              <div className="space-y-4">
                 <div className="p-4 rounded-xl bg-card border border-border space-y-2 group hover:ring-shadow transition-all">
                    <div className="flex justify-between items-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                       <span>Context Pool</span>
                       <span className="text-primary">{bufferUsage.pct}%</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-primary" style={{ width: `${bufferUsage.pct}%` }} />
                    </div>
                 </div>
                 <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                       <span>Model Latency</span>
                       <span className="text-emerald-500">
                         {lastLatencyMs === null ? "—" : `${lastLatencyMs}ms`}
                       </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Measured from the last `/api/chat` request.
                    </p>
                 </div>
                 <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                       <span>Dependency checks</span>
                       <span
                         className={cn(
                           "text-[11px]",
                           health?.status === "ok" ? "text-emerald-500" : "text-amber-500",
                         )}
                       >
                         {health?.status ?? "unknown"}
                       </span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Source: `/api/health` (db/redis/object-store readiness)
                    </p>
                 </div>
              </div>
           </div>

           <div className="ares-card p-6 bg-secondary/10 whisper-shadow flex-1">
              <h3 className="text-lg font-serif font-medium mb-6 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-primary" />
                 Memory Map
              </h3>
              <div className="space-y-3">
                <p className="text-[12px] text-muted-foreground">
                  Memory map (heuristic) from recent console messages:
                </p>
                {memoryMap.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/70 italic">
                    No memory yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {memoryMap.map((m) => (
                      <li
                        key={m.w}
                        className="flex items-center justify-between text-[12px] font-mono bg-card border border-border rounded-lg px-3 py-2"
                      >
                        <span className="text-foreground">{m.w}</span>
                        <span className="text-muted-foreground">×{m.c}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Console history persists locally when you leave this page.
                </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
