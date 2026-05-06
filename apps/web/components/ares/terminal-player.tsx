"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Line =
  | { role: "input"; text: string; ms?: number }
  | { role: "output"; text: string; ms?: number; tone?: "muted" | "ok" | "warn" | "accent" }
  | { role: "blank"; ms?: number };

type Script = { label: string; install: string; lines: Line[] };

const MAC_SCRIPT: Script = {
  label: "Mac / Linux",
  install: "curl -fsSL https://ares.dev/install.sh | bash",
  lines: [
    { role: "input", text: "curl -fsSL https://ares.dev/install.sh | bash" },
    { role: "output", text: "→ verifying checksum  ........  ok", tone: "muted", ms: 360 },
    { role: "output", text: "→ fetching agent      ........  12.4 MB", tone: "muted", ms: 420 },
    { role: "output", text: "→ registering daemon  ........  ares.sockd", tone: "muted", ms: 420 },
    { role: "output", text: "✓ installed ARES v1.4.2", tone: "ok", ms: 480 },
    { role: "blank", ms: 220 },
    { role: "input", text: "ares init --repo solana-ops/core" },
    { role: "output", text: "▸ attaching oracle agent", tone: "accent", ms: 340 },
    { role: "output", text: "▸ watching 12 programs on mainnet-beta", tone: "accent", ms: 360 },
    { role: "output", text: "▸ streaming telemetry → ares.dev/console", tone: "muted", ms: 380 },
  ],
};

const WIN_SCRIPT: Script = {
  label: "Windows",
  install: "irm https://ares.dev/install.ps1 | iex",
  lines: [
    { role: "input", text: "irm https://ares.dev/install.ps1 | iex" },
    { role: "output", text: "→ verifying signature ........  ok", tone: "muted", ms: 360 },
    { role: "output", text: "→ fetching agent      ........  13.1 MB", tone: "muted", ms: 420 },
    { role: "output", text: "→ registering service ........  AresAgent", tone: "muted", ms: 420 },
    { role: "output", text: "✓ installed ARES v1.4.2", tone: "ok", ms: 480 },
    { role: "blank", ms: 220 },
    { role: "input", text: "ares init --repo solana-ops/core" },
    { role: "output", text: "▸ attaching oracle agent", tone: "accent", ms: 340 },
    { role: "output", text: "▸ watching 12 programs on mainnet-beta", tone: "accent", ms: 360 },
    { role: "output", text: "▸ streaming telemetry → ares.dev/console", tone: "muted", ms: 380 },
  ],
};

const TYPE_SPEED_MS = 28;

export function TerminalPlayer() {
  const [os, setOs] = useState<"mac" | "win">("mac");
  const [copied, setCopied] = useState(false);
  const [frames, setFrames] = useState<Line[]>([]);
  const [typingIndex, setTypingIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const script = useMemo(() => (os === "mac" ? MAC_SCRIPT : WIN_SCRIPT), [os]);

  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const resetPlayback = useCallback(() => {
    setFrames([]);
    setTypingIndex(0);
    setTypedChars(0);
    setDone(false);
    setRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    resetPlayback();
  }, [os, resetPlayback]);

  useEffect(() => {
    if (reducedMotion) {
      setFrames(script.lines);
      setDone(true);
      return;
    }

    if (typingIndex >= script.lines.length) {
      setDone(true);
      return;
    }

    const current = script.lines[typingIndex];

    if (current.role === "input") {
      if (typedChars < current.text.length) {
        const t = setTimeout(() => setTypedChars((c) => c + 1), TYPE_SPEED_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => {
        setFrames((f) => [...f, current]);
        setTypingIndex((i) => i + 1);
        setTypedChars(0);
      }, 260);
      return () => clearTimeout(t);
    }

    const delay = current.role === "blank" ? current.ms ?? 200 : current.ms ?? 320;
    const t = setTimeout(() => {
      setFrames((f) => [...f, current]);
      setTypingIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [typingIndex, typedChars, script, reducedMotion, runKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [frames, typedChars]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(script.install);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const live = script.lines[typingIndex];
  const livePartial =
    live && live.role === "input" ? live.text.slice(0, typedChars) : "";

  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* chrome */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em]">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive/70" aria-hidden />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70" aria-hidden />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" aria-hidden />
          </div>
          <span className="h-3 w-px bg-border" />
          <span className="text-muted-foreground">Install</span>
          <span className="h-3 w-px bg-border" />
          <button
            onClick={() => setOs("mac")}
            className={cn(
              "transition-colors",
              os === "mac"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Mac/Linux
          </button>
          <button
            onClick={() => setOs("win")}
            className={cn(
              "transition-colors",
              os === "win"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Windows
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={resetPlayback}
            aria-label="Replay install demo"
            className="opacity-60 hover:opacity-100 transition-opacity"
            title="Replay"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            aria-label="Copy install command"
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* body */}
      <div
        ref={scrollRef}
        className="px-4 py-5 font-mono text-[13px] leading-relaxed min-h-[268px] max-h-[340px] overflow-y-auto no-scrollbar"
      >
        {frames.map((l, i) => (
          <Row key={`${runKey}-${i}`} line={l} />
        ))}
        {!done && live?.role === "input" && (
          <div className="flex">
            <span className="text-muted-foreground select-none">$&nbsp;</span>
            <span className="text-foreground whitespace-pre">{livePartial}</span>
            <Caret />
          </div>
        )}
        {done && (
          <div className="flex items-center gap-2 pt-2 text-muted-foreground">
            <span className="text-[10.5px] uppercase tracking-[0.18em]">
              ready
            </span>
            <Caret />
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ line }: { line: Line }) {
  if (line.role === "blank") return <div className="h-3" aria-hidden />;
  if (line.role === "input") {
    return (
      <div className="flex">
        <span className="text-muted-foreground select-none">$&nbsp;</span>
        <span className="text-foreground whitespace-pre">{line.text}</span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "whitespace-pre",
        line.tone === "ok" && "text-emerald-600 dark:text-emerald-400",
        line.tone === "warn" && "text-amber-600 dark:text-amber-400",
        line.tone === "accent" && "text-primary",
        (!line.tone || line.tone === "muted") && "text-muted-foreground"
      )}
    >
      {line.text}
    </div>
  );
}

function Caret() {
  return (
    <span
      className="inline-block w-[7px] h-[15px] ml-0.5 translate-y-[2px] bg-foreground animate-pulse"
      aria-hidden
    />
  );
}
