"use client";

import { Bell, Shield, Info, AlertTriangle, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const notifications = [
  {
    id: "n1",
    title: "Vulnerability Resolved",
    description: "Orchestrator successfully patched 'DEX Proxy' through CPI guard injection.",
    time: "2h ago",
    level: "success",
    type: "agent"
  },
  {
    id: "n2",
    title: "Suspicious Activity",
    description: "High velocity flow detected from Unverified Wallet (0x4...2a1) to Treasury.",
    time: "4h ago",
    level: "warning",
    type: "security"
  },
  {
    id: "n3",
    title: "System Update",
    description: "ARES Engine upgraded to v2.5.4 (Gemini 3 Flash optimized).",
    time: "12h ago",
    level: "info",
    type: "system"
  },
  {
    id: "n4",
    title: "New Scan Result",
    description: "Static analysis for 'ares-monorepo' completed with 0 CRITICAL findings.",
    time: "1d ago",
    level: "success",
    type: "report"
  }
];

export default function NotificationsPage() {
  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <div>
        <p className="text-[12px] font-sans font-semibold text-primary uppercase tracking-[0.2em] mb-3">Telemetry Feed</p>
        <h1 className="text-5xl font-serif font-medium tracking-tight text-foreground mb-4">Command Notifications</h1>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          The operational history of all autonomous agent actions and system-level security events.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-4">
          {notifications.map((n) => (
            <div key={n.id} className="ares-card p-6 bg-card border border-border group hover:ring-shadow transition-all flex gap-6 items-start">
               <div className={cn(
                 "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
                 n.level === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-600" :
                 n.level === 'warning' ? "bg-amber-50 border-amber-100 text-amber-600" :
                 "bg-blue-50 border-blue-100 text-blue-600"
               )}>
                  {n.level === 'success' ? <Shield className="w-5 h-5" /> :
                   n.level === 'warning' ? <AlertTriangle className="w-5 h-5" /> :
                   <Info className="w-5 h-5" />}
               </div>
               <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                     <h3 className="text-[16px] font-bold">{n.title}</h3>
                     <span className="text-[12px] font-mono font-bold text-muted-foreground uppercase">{n.time}</span>
                  </div>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {n.description}
                  </p>
               </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
           <div className="ares-card p-6 bg-secondary/10 whisper-shadow">
              <h3 className="text-lg font-serif font-bold mb-6 flex items-center gap-2">
                 <Activity className="w-4 h-4 text-primary" />
                 Alert Topology
              </h3>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">Security Threats</span>
                    <span className="text-[13px] font-bold text-rose-500">2</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">Agent Successes</span>
                    <span className="text-[13px] font-bold text-emerald-500">14</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[13px] text-muted-foreground">System Advisories</span>
                    <span className="text-[13px] font-bold">5</span>
                 </div>
              </div>
           </div>

           <div className="ares-card p-6 border-dashed border-border flex flex-col items-center justify-center text-center space-y-4 py-12">
               <div className="w-12 h-12 bg-secondary/50 rounded-full flex items-center justify-center opacity-30">
                  <Bell className="w-6 h-6" />
               </div>
               <div>
                  <p className="text-[14px] font-bold text-muted-foreground">End of Transmission</p>
                  <p className="text-[12px] text-muted-foreground/60 leading-relaxed max-w-[180px] mx-auto mt-1">
                    No further historical events found in the local telemetry buffer.
                  </p>
               </div>
           </div>
        </div>
      </div>
    </div>
  );
}
