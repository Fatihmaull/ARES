"use client";

import Link from "next/link";
import {
  Brain,
  Shield,
  Activity,
  Search,
  Network,
  Lock,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/ares/site-nav";
import { SiteFooter } from "@/components/ares/site-footer";

const PILLARS = [
  {
    icon: Brain,
    tag: "Context",
    title: "Logical Buffers",
    desc: "Reasoning that persists across cycles for cross-contract discovery.",
  },
  {
    icon: Shield,
    tag: "Autonomy",
    title: "Auditing Loops",
    desc: "Self-correcting agents that verify findings against live chain state.",
  },
  {
    icon: Activity,
    tag: "Invariants",
    title: "Live Monitoring",
    desc: "Bytecode-level invariant checks with millisecond-precision alerts.",
  },
];

const PIPELINE = [
  {
    icon: Search,
    tag: "01 · Discovery",
    title: "Map Protocol Topology",
    desc: "Static analysis and supply-chain telemetry sketch the full attack surface.",
  },
  {
    icon: Network,
    tag: "02 · Reasoning",
    title: "Cross-Reference Threats",
    desc: "Oracle agents correlate findings with global intelligence patterns.",
  },
  {
    icon: Lock,
    tag: "03 · Synthesis",
    title: "Remediation Vectors",
    desc: "Signed briefs with patch diffs, severity, and operator approval.",
  },
];

export default function IntelligencePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="rail rail-frame">
        <SiteNav />
        <main className="flex flex-col">
          <Header />
          <Pillars />
          <Orchestrator />
          <TelemetrySample />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function Header() {
  return (
    <section className="grid-container grid-section border-b border-border relative overflow-hidden">
      <div className="absolute inset-0 noise opacity-70 pointer-events-none" />

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke">
        <span className="label">Intelligence · Autonomous Reasoning</span>
      </div>

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke rail-tick">
        <h1 className="display type-4xl">
          Beyond <span className="italic font-normal">Vector</span> Search
        </h1>
      </div>

      <div className="col-span-full md:col-span-5 lg:col-start-2 lg:col-span-4 cell-pad">
        <p className="type-base text-muted-foreground max-w-[54ch]">
          ARES reasons about protocol state, not just pattern-matches on code.
        </p>
      </div>
    </section>
  );
}

function Pillars() {
  return (
    <section className="grid-container !gap-0 border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-1 cell-pad cell-pad--stroke py-8">
        <span className="label">Pillars</span>
      </div>

      {PILLARS.map((p, i) => (
        <article
          key={p.title}
          className={cn(
            "col-span-full md:col-span-2 lg:col-span-1 cell-pad py-8 flex flex-col gap-5 border-t border-border md:border-t-0",
            i > 0 && "md:border-l md:border-l-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="label">{p.tag}</span>
            <p.icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <h3 className="type-xl font-serif tracking-tight">{p.title}</h3>
          <p className="type-sm text-muted-foreground max-w-[38ch]">{p.desc}</p>
        </article>
      ))}
    </section>
  );
}

function Orchestrator() {
  return (
    <section className="grid-container !gap-0 grid-section border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-3">
        <span className="label-accent">Orchestrator</span>
        <h2 className="type-2xl font-serif tracking-tight">
          The ARES Pipeline
        </h2>
        <p className="type-sm text-muted-foreground max-w-[38ch]">
          Three layers, one deterministic brief delivered to operator.
        </p>
      </div>

      {PIPELINE.map((step, i) => (
        <article
          key={step.title}
          className={cn(
            "col-span-full md:col-span-2 lg:col-span-1 cell-pad py-8 flex flex-col gap-4 border-t border-border md:border-t-0",
            i === 0 ? "lg:col-start-4" : "md:border-l md:border-l-border"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="label">{step.tag}</span>
            <step.icon className="w-4 h-4 text-primary" />
          </div>
          <h3 className="type-lg font-serif tracking-tight">{step.title}</h3>
          <p className="type-sm text-muted-foreground max-w-[34ch]">
            {step.desc}
          </p>
        </article>
      ))}
    </section>
  );
}

function TelemetrySample() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-3">
        <span className="label">Operator View</span>
        <h3 className="type-xl font-serif tracking-tight">Live Telemetry</h3>
        <p className="type-sm text-muted-foreground max-w-[36ch]">
          Briefings arrive pre-triaged. Approve or redirect to a sub-agent.
        </p>
        <Link
          href="/dashboard/overview"
          className="group mt-3 inline-flex items-center justify-between gap-4 px-3 py-2.5 w-fit bg-foreground text-background font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-primary transition-colors"
        >
          Open Console
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-start-4 lg:col-span-3 cell-pad">
        <div className="border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-destructive/70" />
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              ARES_TELEMETRY · v4
            </span>
          </div>
          <div className="px-4 py-5 font-mono text-[13px] leading-relaxed space-y-1.5">
            <p className="text-emerald-700 dark:text-emerald-400">
              [executing] DeFi_Security_Auditor
            </p>
            <p className="text-muted-foreground">
              &gt; mapping pool invariants on DEX:AggregatorProxy
            </p>
            <p className="text-muted-foreground">
              &gt; found potential cpi_guard bypass on instruction 4
            </p>
            <p className="text-primary">
              [critical] delegating to orchestrator for economic impact
            </p>
            <p className="text-emerald-700 dark:text-emerald-400">
              &gt; reasoning complete — emitting brief
            </p>
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2">
              <span className="inline-block w-[6px] h-[13px] bg-primary animate-pulse" />
              <span className="text-primary text-[11px] uppercase tracking-[0.18em]">
                Ready for operator approval
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
