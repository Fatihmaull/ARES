import { NextRequest, NextResponse } from "next/server";
import { ASSTPersistenceSQLite } from "@ares/engine";
import { join } from "node:path";

const DEMO_LOGS = [
  {
    source: "ARES",
    level: "security" as const,
    message: "Telemetry stream online (demo — no chat history yet).",
  },
  {
    source: "System",
    level: "info" as const,
    message: "Persistence ready. Run a scan or chat to populate history.",
  },
];

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (data: unknown) => {
    await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  };

  const writeRaw = async (chunk: string) => {
    await writer.write(encoder.encode(chunk));
  };

  (async () => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const cleanup = () => {
      if (interval) clearInterval(interval);
      interval = undefined;
      writer.close().catch(() => {});
    };

    req.signal.addEventListener("abort", cleanup);

    try {
      // Establish the stream immediately (avoids proxy/dev idle timeouts; no LLM init).
      await writeRaw(": sse-open\n\n");

      const repoRoot = join(process.cwd(), "../..");
      const persistence = new ASSTPersistenceSQLite(repoRoot);
      await persistence.init();

      const history = await persistence.getHistory(20);
      const chronological = [...history].reverse();

      if (chronological.length === 0) {
        const now = new Date().toISOString();
        for (const row of DEMO_LOGS) {
          await send({
            type: "log",
            id: `demo-${row.source}-${row.message.slice(0, 12)}`,
            ...row,
            timestamp: now,
          });
          await new Promise((r) => setTimeout(r, 80));
        }
      } else {
        for (const msg of chronological) {
          await send({
            type: "log",
            source: msg.role === "user" ? "Operator" : "ARES",
            level: msg.role === "user" ? "info" : "security",
            message: msg.content,
            timestamp: msg.timestamp,
          });
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      interval = setInterval(async () => {
        try {
          await send({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          });
        } catch {
          if (interval) clearInterval(interval);
        }
      }, 30000);
    } catch (err) {
      console.error("SSE Error:", err);
      try {
        await send({
          type: "error",
          message: "Failed to open persistence stream.",
        });
      } catch {
        /* stream already closed */
      }
      cleanup();
    }
  })();

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
