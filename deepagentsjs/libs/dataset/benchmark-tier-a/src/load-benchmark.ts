import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { BenchmarkEntry } from "./types.js";

export async function loadJsonl(filePath: string): Promise<BenchmarkEntry[]> {
  const out: BenchmarkEntry[] = [];
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  let lineNo = 0;
  for await (const line of rl) {
    lineNo += 1;
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    try {
      out.push(JSON.parse(t) as unknown as BenchmarkEntry);
    } catch (e) {
      throw new Error(
        `Invalid JSON on line ${lineNo} of ${filePath}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return out;
}

export function indexById(
  entries: BenchmarkEntry[],
): Map<string, BenchmarkEntry> {
  const m = new Map<string, BenchmarkEntry>();
  for (const e of entries) m.set(e.id, e);
  return m;
}
