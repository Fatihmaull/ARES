"use client";

import { cn } from "@/lib/utils";
import { useHealth, type HealthTone } from "@/lib/hooks/use-health";

const toneMap: Record<HealthTone, { dot: string; ring: string; text: string }> = {
  live: { dot: "bg-emerald-500", ring: "bg-emerald-500/40", text: "text-muted-foreground" },
  degraded: { dot: "bg-amber-500", ring: "bg-amber-500/40", text: "text-amber-500" },
  offline: { dot: "bg-destructive", ring: "bg-destructive/40", text: "text-destructive" },
  neutral: { dot: "bg-muted-foreground", ring: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

const DEFAULT_LABELS: Record<HealthTone, string> = {
  live: "Operators Online",
  degraded: "Degraded Performance",
  offline: "Major Outage",
  neutral: "Status Unknown",
};

const SYSTEM_LABELS: Record<HealthTone, string> = {
  live: "All Systems Operational",
  degraded: "Degraded Performance",
  offline: "Major Outage",
  neutral: "Status Unknown",
};

const MONITOR_LABELS: Record<HealthTone, string> = {
  live: "Monitoring Active",
  degraded: "Monitoring Degraded",
  offline: "Monitoring Offline",
  neutral: "Monitoring Idle",
};

type Variant = "operators" | "system" | "monitoring";

type StatusBadgeProps = {
  label?: string;
  className?: string;
  compact?: boolean;
  variant?: Variant;
};

export function StatusBadge({
  label,
  className,
  compact = false,
  variant = "operators",
}: StatusBadgeProps) {
  const { tone } = useHealth();
  const { dot, ring, text } = toneMap[tone];
  const labels =
    variant === "system"
      ? SYSTEM_LABELS
      : variant === "monitoring"
        ? MONITOR_LABELS
        : DEFAULT_LABELS;
  const computedLabel = label ?? labels[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em]",
        compact ? "text-[10px]" : "text-[10.5px]",
        text,
        className,
      )}
      title={computedLabel}
    >
      <span className="relative inline-flex items-center justify-center">
        <span
          className={cn(
            "absolute inline-flex w-2.5 h-2.5 rounded-full opacity-70",
            tone === "live" && "animate-ping",
            ring,
          )}
          aria-hidden
        />
        <span
          className={cn("relative inline-flex w-1.5 h-1.5 rounded-full", dot)}
          aria-hidden
        />
      </span>
      <span>{computedLabel}</span>
    </span>
  );
}
