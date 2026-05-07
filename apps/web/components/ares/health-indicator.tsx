"use client";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ares/status-badge";

interface Props {
  className?: string;
}

export function HealthIndicator({ className }: Props) {
  return (
    <div
      className={cn(
        "items-center gap-4 hidden lg:flex",
        className,
      )}
    >
      <StatusBadge variant="monitoring" />
    </div>
  );
}
