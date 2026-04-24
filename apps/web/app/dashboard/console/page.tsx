"use client";

import { 
  Zap, 
  Terminal as TerminalIcon, 
  Play, 
  Square, 
  ShieldCheck, 
  Activity, 
  Cpu, 
  Search, 
  Lock,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface LogEntry {
  id: string;
  source: string;
  level: 'info' | 'warn' | 'error' | 'security';
  message: string;
  timestamp: string;
}

export default function ConsolePage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);

    let intentionalClose = false;
    const eventSource = new EventSource("/api/console/stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          id?: string;
          source?: string;
          level?: LogEntry["level"];
          message?: string;
          timestamp?: string;
        };
        if (data.type === "log" && data.message && data.timestamp) {
          const entry: LogEntry = {
            id:
              data.id ??
              `${data.timestamp}:${data.message.slice(0, 32)}`,
            source: data.source ?? "ARES",
            level: data.level ?? "info",
            message: data.message,
            timestamp: data.timestamp,
          };
          setLogs((prev) => {
            const exists = prev.some(
              (l) =>
                l.timestamp === entry.timestamp && l.message === entry.message
            );
            if (exists) return prev;
            return [...prev, entry];
          });
          setLoading(false);
        }
      } catch {
        /* ignore malformed chunks */
      }
    };

    eventSource.onerror = () => {
      if (intentionalClose) return;
      // Browser passes Event — it stringifies as {} in console; use readyState.
      const state = eventSource.readyState;
      if (state === EventSource.CLOSED) {
        if (process.env.NODE_ENV === "development") {
          console.warn(
            "[console/stream] SSE closed (readyState=CLOSED). If this appears once in dev, React Strict Mode may have torn down the first connection."
          );
        }
      } else {
        console.warn("[console/stream] SSE issue; readyState=", state);
      }
      eventSource.close();
      setLoading(false);
    };

    return () => {
      intentionalClose = true;
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsg: LogEntry = {
      id: Date.now().toString(),
      source: 'Operator',
      level: 'info',
      message: inputValue,
      timestamp: new Date().toISOString()
    };

    setLogs(prev => [...prev, userMsg]);
    const cmd = inputValue;
    setInputValue("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: cmd })
      });
      const data = await res.json();
      
      const agentMsg: LogEntry = {
        id: (Date.now() + 1).toString(),
        source: 'ARES',
        level: 'security',
        message: data.response || "Command executed successfully.",
        timestamp: new Date().toISOString()
      };
      setLogs(prev => [...prev, agentMsg]);
    } catch (err) {
      const errMsg: LogEntry = {
        id: (Date.now() + 1).toString(),
        source: 'System',
        level: 'error',
        message: "Failed to communicate with the ARES engine.",
        timestamp: new Date().toISOString()
      };
      setLogs(prev => [...prev, errMsg]);
    }
  };

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
          <button className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-xl text-[14px] font-medium hover:bg-muted transition-all ring-shadow">
            <Square className="w-4 h-4" />
            Terminate All
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-[14px] font-medium hover:opacity-90 transition-all shadow-xl shadow-primary/20">
            <Play className="w-4 h-4" />
            Resume System
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
                       <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                       Synchronized
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
                       placeholder="Enter instruction for autonomous agents..." 
                       className="bg-transparent border-none p-0 focus:ring-0 text-[#faf9f5] w-full placeholder:text-[#5e5d59] mt-[-2px]" 
                     />
                  </form>
                  <div ref={bottomRef} />
               </div>

              {/* Footer status */}
              <div className="px-6 py-3 border-t border-[#30302e] bg-[#1a1a18] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-[#5e5d59]">
                 <div className="flex items-center gap-6">
                    <span>CPU: 12%</span>
                    <span>MEM: 1.4GB</span>
                    <span>QUEUE: 0</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    Secure Sandbox: ACTIVE
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
                       <span className="text-primary">82%</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                       <div className="h-full bg-primary w-[82%]" />
                    </div>
                 </div>
                 <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-bold">
                       <span>Model Latency</span>
                       <span className="text-emerald-500">Normal</span>
                    </div>
                    <p className="text-[13px] text-foreground font-sans">184ms RTT (Gemini 3 Flash)</p>
                 </div>
              </div>
           </div>

           <div className="ares-card p-6 bg-secondary/10 whisper-shadow flex-1">
              <h3 className="text-lg font-serif font-medium mb-6 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-primary" />
                 Memory Map
              </h3>
              <div className="space-y-3 opacity-60 italic text-[13px]">
                 <p className="flex items-center gap-2 group hover:text-foreground hover:opacity-100 transition-all cursor-pointer">
                    <Lock className="w-3.5 h-3.5" />
                    Treasury_Contract.sol:412
                 </p>
                 <p className="flex items-center gap-2 group hover:text-foreground hover:opacity-100 transition-all cursor-pointer">
                    <Search className="w-3.5 h-3.5" />
                    Vulnerability_Pattern_DB
                 </p>
                 <p className="flex items-center gap-2 group hover:text-foreground hover:opacity-100 transition-all cursor-pointer">
                    <Cpu className="w-3.5 h-3.5" />
                    Agent_State_Vector_v4
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
