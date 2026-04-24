import { cn } from "@/lib/utils";

type Tone = "live" | "degraded" | "offline" | "neutral";

const toneMap: Record<Tone, { dot: string; ring: string }> = {
  live: { dot: "bg-emerald-500", ring: "bg-emerald-500/40" },
  degraded: { dot: "bg-amber-500", ring: "bg-amber-500/40" },
  offline: { dot: "bg-destructive", ring: "bg-destructive/40" },
  neutral: { dot: "bg-muted-foreground", ring: "bg-muted-foreground/40" },
};

type StatusBadgeProps = {
  label?: string;
  tone?: Tone;
  className?: string;
  compact?: boolean;
};

export function StatusBadge({
  label = "Operators Online",
  tone = "live",
  className,
  compact = false,
}: StatusBadgeProps) {
  const { dot, ring } = toneMap[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em] text-muted-foreground",
        compact ? "text-[10px]" : "text-[10.5px]",
        className
      )}
    >
      <span className="relative inline-flex items-center justify-center">
        <span
          className={cn(
            "absolute inline-flex w-2.5 h-2.5 rounded-full opacity-70 animate-ping",
            ring
          )}
          aria-hidden
        />
        <span
          className={cn("relative inline-flex w-1.5 h-1.5 rounded-full", dot)}
          aria-hidden
        />
      </span>
      <span>{label}</span>
    </span>
  );
}
