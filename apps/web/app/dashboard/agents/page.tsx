"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Search, 
  Filter, 
  Terminal, 
  Cpu, 
  Shield, 
  Settings,
  MoreVertical,
  Activity,
  History,
  Zap,
  Globe
} from "lucide-react";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        const data = await res.json();
        setAgents(data?.data?.agents ?? data ?? []);
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <div>
          <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">Distributed Intelligence</p>
          <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">Autonomous Systems</h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A specialized fleet of AI agents performing deep-packet inspection, 
            contract auditing, and behavioral research in real-time.
          </p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 bg-primary rounded-xl text-[14px] font-medium text-primary-foreground hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 shrink-0">
          <Plus className="w-4 h-4" />
          Deploy New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {agents.map((agent: any) => (
          <div key={agent.id} className="ares-card whisper-shadow group hover:ring-shadow transition-all flex flex-col h-full bg-secondary/10 hover:bg-card border border-border">
            <div className="p-8 space-y-6 flex-1">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center border border-border group-hover:border-primary/20 transition-all shadow-sm">
                   {agent.name.toLowerCase().includes('coordinator') || agent.name.toLowerCase().includes('auditor') ? <Shield className="w-6 h-6 text-primary" /> : <Cpu className="w-6 h-6 text-primary" />}
                </div>
                <div className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                  agent.status === 'running' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/10 animate-pulse" : "bg-muted text-muted-foreground border-border"
                )}>
                  {agent.status}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-serif font-medium mb-1 group-hover:text-primary transition-colors leading-tight">{agent.name}</h3>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-tighter opacity-60">{agent.type}</p>
              </div>

              <div className="p-4 bg-secondary/50 rounded-xl border border-border/50">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-2">Current Task</p>
                <p className="text-[14px] font-sans text-foreground leading-snug truncate">{agent.currentTask || "Listening for telemetry stream..."}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Stability</p>
                  <p className="text-xl font-serif font-medium">
                    {typeof agent.successRate === "number"
                      ? `${agent.successRate.toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Engine</p>
                  <p className="text-xl font-serif font-medium truncate" title={agent.model}>{agent.model.split('/').pop()?.split(':')[0] || agent.model.split('-')[0]}</p>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-border bg-secondary/20 flex items-center justify-between">
               <button className="text-[13px] font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                 <History className="w-4 h-4" />
                 Execution History
               </button>
               <button className="p-2 border border-border rounded-lg hover:bg-card transition-all">
                 <Settings className="w-4 h-4 text-muted-foreground" />
               </button>
            </div>
          </div>
        ))}

        {loading && [1, 2, 3].map(i => (
          <div key={i} className="ares-card p-12 flex items-center justify-center bg-secondary/10 border border-border border-dashed animate-pulse">
            <Activity className="w-8 h-8 text-muted-foreground/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
