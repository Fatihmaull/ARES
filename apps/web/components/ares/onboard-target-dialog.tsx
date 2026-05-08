"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeResponseJson } from "@/lib/safe-response-json";

export type TargetKind =
  | "solana_program"
  | "evm_contract"
  | "github_repo"
  | "domain"
  | "wallet";

const KIND_OPTIONS: { id: TargetKind; label: string; placeholder: string }[] = [
  {
    id: "solana_program",
    label: "Solana program",
    placeholder: "Program address (base58, 32-44 chars)",
  },
  {
    id: "evm_contract",
    label: "EVM contract",
    placeholder: "0x… (40 hex chars)",
  },
  {
    id: "github_repo",
    label: "GitHub repo",
    placeholder: "owner/repo or https://github.com/owner/repo",
  },
  { id: "domain", label: "Domain", placeholder: "example.com" },
  {
    id: "wallet",
    label: "Wallet",
    placeholder: "Solana wallet address (base58)",
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (target: { id: string }) => void;
}

export function OnboardTargetDialog({ open, onClose, onCreated }: Props) {
  const [kind, setKind] = useState<TargetKind>("github_repo");
  const [identifier, setIdentifier] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIdentifier("");
      setLabel("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const placeholder =
    KIND_OPTIONS.find((k) => k.id === kind)?.placeholder ?? "";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!identifier.trim()) {
      setError("Identifier is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          identifier: identifier.trim(),
          label: label.trim() || null,
        }),
      });
      const body = await safeResponseJson<{
        ok?: boolean;
        data?: { target?: { id: string } };
        error?: { message?: string };
      }>(res);
      if (!res.ok || !body?.ok) {
        const msg =
          body?.error?.message ||
          (res.status === 403
            ? "Wallet session required."
            : `Request failed (${res.status}).`);
        setError(msg);
        return;
      }
      const target = body.data?.target;
      if (target) onCreated(target);
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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-serif font-medium">Onboard asset</h2>
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
          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2 block">
              Kind
            </label>
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKind(opt.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-[13px] border transition-colors text-left",
                    kind === opt.id
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2 block">
              Identifier
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={placeholder}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2 block">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Human-friendly name"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-[14px] focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          {error && (
            <p className="text-[13px] text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
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
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? "Onboarding…" : "Onboard"}
          </button>
        </div>
      </form>
    </div>
  );
}
