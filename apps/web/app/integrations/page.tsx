"use client";

import Link from "next/link";
import {
  Code,
  MessageSquare,
  Cable,
  Zap,
  Shield,
  Cloud,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/ares/site-nav";
import { SiteFooter } from "@/components/ares/site-footer";

const INTEGRATIONS = [
  {
    name: "GitHub Actions",
    icon: Code,
    category: "CI/CD",
    desc: "Automate ARES scans on every pull request.",
  },
  {
    name: "Comm Channels",
    icon: MessageSquare,
    category: "Alerting",
    desc: "Stream agent findings into your engineering war rooms.",
  },
  {
    name: "Terraform",
    icon: Cable,
    category: "IaC",
    desc: "Scan infra manifests for insecure permissioning and secrets.",
  },
  {
    name: "Solana RPC",
    icon: Zap,
    category: "Network",
    desc: "Monitor program upgrades and treasury flows live.",
  },
  {
    name: "PagerDuty",
    icon: Shield,
    category: "Incident",
    desc: "Route logical buffer alerts to on-call responders instantly.",
  },
  {
    name: "AWS Security Hub",
    icon: Cloud,
    category: "SIEM",
    desc: "Aggregate ARES intelligence into enterprise dashboards.",
  },
] as const;

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="rail rail-frame">
        <SiteNav />
        <main className="flex flex-col">
          <Header />
          <IntegrationGrid />
          <DevSDK />
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
        <span className="label">Integrations · Omnichannel Security</span>
      </div>

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke rail-tick">
        <h1 className="display type-4xl">
          Unified <span className="italic font-normal">Control</span> Plane
        </h1>
      </div>

      <div className="col-span-full md:col-span-5 lg:col-start-2 lg:col-span-4 cell-pad">
        <p className="type-base text-muted-foreground max-w-[54ch]">
          Attach ARES to your dev lifecycle — from commit to on-chain execution.
        </p>
      </div>
    </section>
  );
}

function IntegrationGrid() {
  return (
    <section className="grid-container !gap-0 border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-1 cell-pad cell-pad--stroke py-8">
        <span className="label">Surfaces</span>
      </div>

      {INTEGRATIONS.map((it, i) => {
        const Icon = it.icon;
        return (
          <article
            key={it.name}
            className={cn(
              "group col-span-full md:col-span-3 lg:col-span-1 cell-pad py-8 flex flex-col gap-5 border-t border-border md:border-t-0 hover:bg-accent/30 transition-colors",
              i > 0 && "md:border-l md:border-l-border"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="label">{it.category}</span>
              <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="type-lg font-serif tracking-tight group-hover:text-primary transition-colors">
              {it.name}
            </h3>
            <p className="type-sm text-muted-foreground max-w-[34ch]">
              {it.desc}
            </p>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground mt-auto group-hover:text-primary group-hover:-translate-y-0.5 transition-all" />
          </article>
        );
      })}
    </section>
  );
}

function DevSDK() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-3">
        <span className="label-accent">Developer SDK</span>
        <h2 className="type-xl font-serif tracking-tight">
          Coming soon
        </h2>
        <p className="type-sm text-muted-foreground max-w-[38ch]">
          CLI and SDK surfaces will return as a polished release.
        </p>

        <button
          type="button"
          disabled
          className="group mt-3 inline-flex items-center justify-between gap-4 px-3 py-2.5 w-fit bg-secondary text-muted-foreground font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 cursor-not-allowed"
        >
          Documentation (coming soon)
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
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
              ares.sdk · CLI
            </span>
          </div>
          <div className="px-4 py-5">
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              CLI install, SDK wiring, and CI integrations are being rebuilt.
              This section will return as an opt-in “coming soon” surface.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
