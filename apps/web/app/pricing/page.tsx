"use client";

import Link from "next/link";
import { Check, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SiteNav } from "@/components/ares/site-nav";
import { SiteFooter } from "@/components/ares/site-footer";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    cadence: "forever",
    desc: "For builders and open-source researchers.",
    features: [
      "50 AI credits / month",
      "5 asset targets",
      "Standard vulnerability scans",
      "GitHub integration",
      "Community support",
    ],
    cta: "Start Free",
    featured: false,
  },
  {
    name: "Operator",
    price: "$35",
    cadence: "per month",
    desc: "For security teams and active traders.",
    features: [
      "500 AI credits / month",
      "50 asset targets",
      "Deep reasoning buffers",
      "Real-time telemetry (SSE)",
      "Priority agent execution",
      "Exportable PDF reports",
    ],
    cta: "Get Started",
    featured: false,
  },
  {
    name: "Sentinel",
    price: "$60",
    cadence: "per month",
    desc: "For protocol guardians and DAOs.",
    features: [
      "1,000 AI credits / month",
      "Unlimited asset targets",
      "Multi-chain threat graphs",
      "Custom sub-agent nodes",
      "Governance alert routing",
      "Audit archive access",
    ],
    cta: "Upgrade",
    featured: true,
  },
  {
    name: "Commander",
    price: "$130",
    cadence: "per month",
    desc: "Autonomous security for enterprise protocols.",
    features: [
      "3,000 AI credits / month",
      "Full infrastructure SDK",
      "Dedicated reasoning buffer",
      "24/7 security advisory",
      "Custom ML fine-tuning",
      "On-chain governance voting",
    ],
    cta: "Go Pro",
    featured: false,
  },
] as const;

const RAILS = [
  { label: "Solana Pay", href: "https://solanapay.com", tag: "SPL-USDC" },
  { label: "Marquee", href: "https://mpp.dev", tag: "x402" },
  { label: "PayAI", href: "https://payai.network", tag: "Agent-Routed" },
  { label: "Stripe", href: "https://stripe.com", tag: "Fiat Bridge" },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="rail rail-frame">
        <SiteNav />
        <main className="flex flex-col">
          <Header />
          <Tiers />
          <OnDemand />
          <Rails />
          <FAQ />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}

function Header() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke">
        <span className="label">Pricing · Access Tiers</span>
      </div>
      <div className="col-span-full md:col-span-6 lg:col-start-2 lg:col-span-5 cell-pad cell-pad--stroke rail-tick">
        <h1 className="display type-4xl">
          Intelligence As <span className="italic font-normal">Utility</span>
        </h1>
      </div>
      <div className="col-span-full md:col-span-5 lg:col-start-2 lg:col-span-4 cell-pad">
        <p className="type-base text-muted-foreground max-w-[54ch]">
          Scale autonomous security on a plan that fits your execution envelope.
        </p>
      </div>
    </section>
  );
}

function Tiers() {
  return (
    <section className="grid-container !gap-0 border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-1 cell-pad cell-pad--stroke py-8">
        <span className="label">Plans</span>
      </div>

      {TIERS.map((t, i) => (
        <article
          key={t.name}
          className={cn(
            "col-span-full md:col-span-3 lg:col-span-1 cell-pad flex flex-col gap-6 py-8 border-t border-border md:border-t-0",
            i > 0 && "md:border-l md:border-l-border",
            t.featured && "bg-accent/40"
          )}
        >
          <div className="flex items-start justify-between">
            <h3 className="type-lg font-serif tracking-tight">{t.name}</h3>
            {t.featured && (
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary border border-primary/30 bg-primary/5 px-1.5 py-0.5">
                Popular
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-serif text-[42px] leading-none tracking-tight">
              {t.price}
            </span>
            <span className="label">{t.cadence}</span>
          </div>

          <p className="type-sm text-muted-foreground max-w-[38ch]">{t.desc}</p>

          <ul className="flex flex-col gap-2.5 flex-1">
            {t.features.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2.5 type-sm text-foreground"
              >
                <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-[3px]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/dashboard/overview"
            className={cn(
              "group inline-flex items-center justify-between gap-4 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors",
              t.featured
                ? "bg-foreground text-background hover:bg-primary"
                : "border border-border hover:bg-accent"
            )}
          >
            {t.cta}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </article>
      ))}
    </section>
  );
}

function OnDemand() {
  return (
    <section className="grid-container !gap-0 grid-section border-b border-border">
      <div className="col-span-full md:col-span-3 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-3 py-8">
        <span className="label-accent">ARES On-Demand</span>
        <h3 className="type-xl font-serif tracking-tight">Pay Per Audit Run</h3>
        <p className="type-sm text-muted-foreground max-w-[42ch]">
          Ad-hoc scans routed through Solana Pay. Start from five dollars.
        </p>
        <Link
          href="/dashboard/overview"
          className="group mt-3 inline-flex items-center justify-between gap-4 px-3 py-2.5 w-fit bg-foreground text-background font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-primary transition-colors"
        >
          Run Single Audit
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="col-span-full md:col-span-3 lg:col-span-3 cell-pad flex flex-col gap-3 py-8 border-t md:border-t-0 md:border-l border-border">
        <span className="label">Enterprise</span>
        <h3 className="type-xl font-serif tracking-tight italic">
          Let&apos;s talk
        </h3>
        <p className="type-sm text-muted-foreground max-w-[42ch]">
          Custom infrastructure, SLAs, and dedicated oracle nodes.
        </p>
        <Link
          href="mailto:ops@ares.protocol"
          className="group mt-3 inline-flex items-center justify-between gap-4 px-3 py-2.5 w-fit border border-border font-mono text-[11px] uppercase tracking-[0.18em] hover:bg-accent transition-colors"
        >
          Contact Sales
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </section>
  );
}

function Rails() {
  return (
    <section className="grid-container !gap-0 border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-1 cell-pad cell-pad--stroke py-8">
        <span className="label">Settlement</span>
      </div>

      {RAILS.map((r, i) => (
        <Link
          key={r.label}
          href={r.href}
          target="_blank"
          className={cn(
            "group col-span-full md:col-span-2 lg:col-span-1 cell-pad py-8 flex flex-col gap-3 border-t border-border md:border-t-0 hover:bg-accent/30 transition-colors",
            i > 0 && "md:border-l md:border-l-border"
          )}
        >
          <span className="label">{r.tag}</span>
          <span className="font-serif text-[22px] leading-tight tracking-tight group-hover:text-primary transition-colors">
            {r.label}
          </span>
          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:-translate-y-0.5 transition-all mt-auto" />
        </Link>
      ))}
    </section>
  );
}

const FAQS = [
  {
    q: "What counts as an AI credit?",
    a: "One credit represents one reasoning step by an ARES agent — a scan, diff, or classification.",
  },
  {
    q: "Can I switch tiers mid-cycle?",
    a: "Yes. Credits prorate and unused allocation rolls into the next billing period.",
  },
  {
    q: "Do you offer on-chain settlement?",
    a: "Solana Pay and x402 are native. Stripe is available as a fiat bridge for enterprise.",
  },
];

function FAQ() {
  return (
    <section className="grid-container grid-section border-b border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-2">
        <span className="label">FAQ</span>
        <h3 className="type-xl font-serif tracking-tight">Common Questions</h3>
      </div>

      <div className="col-span-full md:col-span-4 lg:col-start-4 lg:col-span-3 cell-pad flex flex-col">
        {FAQS.map((f, i) => (
          <div
            key={f.q}
            className={cn(
              "flex flex-col gap-2 py-5",
              i > 0 && "border-t border-border"
            )}
          >
            <h4 className="font-serif text-[18px] tracking-tight text-foreground">
              {f.q}
            </h4>
            <p className="type-sm text-muted-foreground max-w-[58ch]">{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
