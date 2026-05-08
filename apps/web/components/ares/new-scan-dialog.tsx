"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";
import type { TargetKind } from "./onboard-target-dialog";

interface TargetDto {
  id: string;
  kind: TargetKind;
  identifier: string;
  label: string | null;
  archivedAt: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onEnqueued: (info: { runId: string }) => void;
}

export function NewScanDialog({ open, onClose, onEnqueued }: Props) {
  const [targets, setTargets] = useState<TargetDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/targets", { cache: "no-store" });
      if (res.status === 403) {
        setNeedsAuth(true);
        setTargets([]);
        return;
      }
      setNeedsAuth(false);
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { targets?: TargetDto[] };
      }>(res);
      const list = (body?.data?.targets ?? []).filter(
        (t) => !t.archivedAt,
      );
      setTargets(list);
      setSelected((prev) =>
        prev && list.some((t) => t.id === prev) ? prev : list[0]?.id ?? "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/targets/${selected}/scan`, {
        method: "POST",
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { runId?: string };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok || !body.data?.runId) {
        setError(body?.error?.message ?? `Scan failed (${res.status}).`);
        return;
      }
      onEnqueued({ runId: body.data.runId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-serif font-medium">Start a new scan</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {needsAuth ? (
            <p className="text-[13px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-3">
              Connect a wallet and sign in to launch scans.
            </p>
          ) : (
            <>
              <div>
                <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2 block">
                  Target
                </label>
                {loading ? (
                  <p className="text-[13px] text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading targets…
                  </p>
                ) : targets.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No targets onboarded. Visit the Targets page first.
                  </p>
                ) : (
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[14px]"
                  >
                    {targets.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.kind}] {t.label || t.identifier}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <p className="text-[12px] text-muted-foreground">
                Costs <strong>10 units</strong> when wallet has credits;
                otherwise consumes a free-tier scan.
              </p>

              {error && (
                <p className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-secondary/20 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              submitting || needsAuth || loading || !selected || !targets.length
            }
            className={cn(
              "px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2",
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Enqueuing…" : "Start scan"}
          </button>
        </div>
      </div>
    </div>
  );
}
