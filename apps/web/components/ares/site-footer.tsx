import Link from "next/link";
import { Logo } from "./logo";
import { StatusBadge } from "./status-badge";

const FOOTER_COLS = [
  {
    heading: "Product",
    links: [
      { label: "Intelligence", href: "/intelligence" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "Launch Console", href: "/dashboard/overview" },
    ],
  },
  {
    heading: "Operators",
    links: [
      { label: "Targets", href: "/dashboard/targets" },
      { label: "Detections", href: "/dashboard/detections" },
      { label: "Investigations", href: "/dashboard/investigations" },
      { label: "Reports", href: "/dashboard/reports" },
    ],
  },
  {
    heading: "Command",
    links: [
      { label: "Agents", href: "/dashboard/agents" },
      { label: "Console", href: "/dashboard/console" },
      { label: "Overview", href: "/dashboard/overview" },
      { label: "Settings", href: "/dashboard/settings" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "\uD835\uDD4F @aresprotocol", href: "https://x.com" },
      { label: "GitHub", href: "https://github.com" },
      { label: "Discord", href: "https://discord.com" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="grid-container border-t border-border">
      <div className="col-span-full md:col-span-2 lg:col-start-2 lg:col-span-2 cell-pad cell-pad--stroke flex flex-col gap-6">
        <Link href="/" className="inline-flex">
          <Logo size={22} />
        </Link>

        <StatusBadge label="All Systems Operational" />

        <p className="type-sm text-muted-foreground max-w-[28ch]">
          Autonomous security for on-chain infrastructure and the agents that
          touch it.
        </p>
      </div>

      {FOOTER_COLS.map((col) => (
        <div
          key={col.heading}
          className="col-span-2 md:col-span-1 lg:col-span-1 cell-pad flex flex-col gap-3"
        >
          <span className="label">{col.heading}</span>
          <ul className="flex flex-col gap-2 type-sm">
            {col.links.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="col-span-full border-t border-border cell-pad flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          © {new Date().getFullYear()} ARES Protocol
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Engineered For Defense
        </p>
      </div>
    </footer>
  );
}
