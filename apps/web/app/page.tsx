"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/ares/site-nav";
import { SiteFooter } from "@/components/ares/site-footer";
import { TerminalPlayer } from "@/components/ares/terminal-player";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="rail rail-frame">
        <SiteNav />
        <main className="flex flex-col">
          <Hero />
          <Install />
          <Explore />
          <News />
          <Testimonials />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="grid-container grid-section relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 noise opacity-70 pointer-events-none" />

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke">
        <span className="label">Agentic Security Protocol · v1.4</span>
      </div>

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke rail-tick">
        <h1 className="display type-4xl">
          Autonomous{" "}
          <span className="italic font-normal">Security</span> For The Frontier.
        </h1>
      </div>

      <div className="col-span-full md:col-span-5 lg:col-start-2 lg:col-span-4 cell-pad flex flex-col gap-4">
        <p className="type-base text-foreground max-w-[52ch]">
          ARES is the autonomous security protocol for on-chain infrastructure
          and agents.
        </p>
        <p className="type-sm text-muted-foreground max-w-[52ch]">
          Run continuously, pay only for what you scan.
        </p>
      </div>

      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/dashboard/overview"
          className="group inline-flex items-center justify-between gap-6 px-4 py-3 bg-foreground text-background font-mono text-[12px] uppercase tracking-[0.18em] hover:bg-primary transition-colors"
        >
          Launch Command Center
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/integrations"
          className="group inline-flex items-center justify-between gap-6 px-4 py-3 border border-border font-mono text-[12px] uppercase tracking-[0.18em] hover:bg-accent transition-colors"
        >
          Read The Manual
          <ArrowUpRight className="w-4 h-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}

/* ---------------- Install ---------------- */

function Install() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-2">
        <span className="label-accent">Install ARES</span>
        <p className="type-lg font-serif tracking-tight">
          Available in terminal
        </p>
        <p className="type-sm text-muted-foreground max-w-[32ch]">
          One line installs the agent, the CLI, and the updater.
        </p>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-start-4 lg:col-span-3 cell-pad">
        <TerminalPlayer />
      </div>
    </section>
  );
}

/* ---------------- Explore ---------------- */

type Thread = {
  title: string;
  handle: string;
  badge: "Oracle" | "Agent" | "Librarian";
  prompts: number;
  files: number;
  stats: { add: number; del: number; touched: number };
};

const THREADS: Thread[] = [
  {
    title: "Treasury drain reverted mid-transaction",
    handle: "solana-ops",
    badge: "Agent",
    prompts: 3,
    files: 14,
    stats: { add: 240, del: 89, touched: 52 },
  },
  {
    title: "PDA privilege escalation patched fast",
    handle: "defi-guard",
    badge: "Oracle",
    prompts: 21,
    files: 23,
    stats: { add: 612, del: 34, touched: 18 },
  },
  {
    title: "Bridge oracle deviation captured live",
    handle: "bridge-lab",
    badge: "Agent",
    prompts: 6,
    files: 8,
    stats: { add: 156, del: 22, touched: 11 },
  },
  {
    title: "Multisig drift detected early",
    handle: "multisig-kit",
    badge: "Oracle",
    prompts: 18,
    files: 31,
    stats: { add: 420, del: 178, touched: 63 },
  },
  {
    title: "Sandwich pattern traced back",
    handle: "mev-watch",
    badge: "Librarian",
    prompts: 11,
    files: 19,
    stats: { add: 287, del: 94, touched: 37 },
  },
  {
    title: "Flash loan exploit contained",
    handle: "flash-loan-ops",
    badge: "Oracle",
    prompts: 4,
    files: 12,
    stats: { add: 189, del: 56, touched: 22 },
  },
];

function Explore() {
  return (
    <section className="grid-container !gap-0 grid-section border-b border-border relative z-10 !pb-0">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-3">
        <span className="label">Operations</span>
        <h2 className="type-xl font-serif">Explore With Us</h2>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-start-4 lg:col-span-3 cell-pad flex flex-col gap-3 self-end">
        <p className="type-lg font-serif tracking-tight text-foreground">
          See how operators secure infrastructure with ARES
        </p>
      </div>

      <div className="col-span-full">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 py-10 no-scrollbar">
          {THREADS.map((t, i) => (
            <ThreadCard key={i} thread={t} index={i} />
          ))}
          <div className="shrink-0 w-4" aria-hidden />
        </div>
      </div>
    </section>
  );
}

function ThreadCard({ thread, index }: { thread: Thread; index: number }) {
  const { title, handle, badge, prompts, files, stats } = thread;
  return (
    <article className="snap-start shrink-0 w-[280px] sm:w-[300px] md:w-[320px]">
      <Link
        href={`/chronicle/${handle}`}
        className="block h-[418px] border border-border bg-card hover:bg-accent/40 transition-colors group"
      >
        <div className="h-full flex flex-col">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <span className="label">
              Thread · {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.18em] px-1.5 py-0.5 border",
                badge === "Oracle" &&
                  "text-primary border-primary/40 bg-primary/5",
                badge === "Agent" &&
                  "text-foreground border-foreground/30 bg-foreground/5",
                badge === "Librarian" &&
                  "text-muted-foreground border-border bg-muted/40"
              )}
            >
              {badge}
            </span>
          </div>

          <div className="p-5 flex-1 flex flex-col gap-4">
            <h3 className="font-serif tracking-tight text-[24px] leading-[1.05] text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>

            <p className="font-mono type-xs text-muted-foreground">@{handle}</p>

            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between type-xs text-muted-foreground font-mono uppercase tracking-wider">
                <span>{prompts} prompts</span>
                <span>{files} files</span>
              </div>

              <div className="flex items-center gap-3 font-mono text-[12px]">
                <span className="text-emerald-700 dark:text-emerald-400">
                  +{stats.add}
                </span>
                <span className="text-destructive/80">−{stats.del}</span>
                <span className="text-muted-foreground">~{stats.touched}</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border flex items-center justify-between">
            <span className="label">Read thread</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>
      </Link>
    </article>
  );
}

/* ---------------- News ---------------- */

type NewsItem = { date: string; title: string; desc: string; href: string };

const NEWS: NewsItem[] = [
  {
    date: "April 22, 2026",
    title: "Shadow Audit Mode",
    desc: "Run silent continuous audits without alerting on-chain observers.",
    href: "/chronicle/shadow-audit-mode",
  },
  {
    date: "April 14, 2026",
    title: "Chain Guard v2",
    desc: "Real-time multichain monitoring is now generally available for operators.",
    href: "/chronicle/chain-guard-v2",
  },
  {
    date: "April 02, 2026",
    title: "Agent Protocol v1.4",
    desc: "Autonomous agents arrive with self-healing incident response loops.",
    href: "/chronicle/agent-protocol-v14",
  },
  {
    date: "March 28, 2026",
    title: "ARES Free Opens",
    desc: "Anyone can run local ARES with an open quota.",
    href: "/chronicle/ares-free-opens",
  },
];

function News() {
  return (
    <section className="grid-container !gap-0 grid-section !py-0 border-b border-border">
      <div className="col-span-1 md:col-span-2 lg:col-span-1 cell-pad cell-pad--stroke py-[var(--cell-pad)] flex flex-col gap-2 lg:row-span-2">
        <span className="label">News</span>
        <h2 className="type-xl font-serif">Announcements of ARES</h2>
      </div>

      {NEWS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="group col-span-full md:col-span-4 lg:col-start-2 lg:col-span-5 flex flex-col md:grid md:grid-cols-[auto_1fr] gap-x-8 gap-y-2 py-6 px-5 transition-colors border-t border-border first-of-type:border-t-0 md:first-of-type:border-t-0 relative hover:bg-accent/30"
        >
          <span className="label whitespace-nowrap pt-1.5">{item.date}</span>
          <div className="flex flex-col gap-1.5">
            <h3 className="type-lg font-serif tracking-tight text-foreground group-hover:text-primary transition-colors">
              {item.title}
            </h3>
            <p className="type-sm text-muted-foreground max-w-[58ch]">
              {item.desc}
            </p>
          </div>
          <ArrowUpRight className="hidden lg:block absolute top-6 right-5 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
        </Link>
      ))}

      <Link
        href="/chronicle"
        className="col-span-full md:col-span-4 lg:col-start-2 lg:col-span-5 cell-pad text-center py-5 hover:bg-accent/30 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors border-t border-border"
      >
        View More News →
      </Link>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

const QUOTES = [
  {
    quote:
      "We've been running ARES in shadow mode for a month. It already caught a signer drift we'd have missed.",
    author: "maya.sol",
  },
  {
    quote:
      "Finally a security agent that doesn't wake me up for false positives. The triage is actually sharp.",
    author: "yonas",
  },
  {
    quote:
      "Switched from three separate scanners. ARES replaced the whole stack in a weekend.",
    author: "0xkovacs",
  },
  {
    quote:
      "The Oracle agent reads our repo like a senior reviewer. Not sure how else to describe it.",
    author: "priya.dev",
  },
];

function Testimonials() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke">
        <span className="label">Operators On ARES</span>
      </div>

      {QUOTES.map((q, i) => (
        <figure
          key={i}
          className={cn(
            "col-span-full md:col-span-3 lg:col-span-2 cell-pad flex flex-col gap-4 py-8 border-t border-border",
            i % 2 === 0 ? "lg:col-start-2" : "lg:col-start-4"
          )}
        >
          <blockquote className="font-serif text-[22px] leading-[1.15] tracking-tight text-foreground max-w-[48ch]">
            “{q.quote}”
          </blockquote>
          <figcaption className="label">— @{q.author}</figcaption>
        </figure>
      ))}
    </section>
  );
}
