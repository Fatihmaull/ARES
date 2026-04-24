/**
 * Validate benchmark JSONL against benchmark-entry.schema.json, HTTPS rules,
 * and one primary_evidence_url minimum (enforced in schema; HTTPS checked here for clarity).
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import type { ErrorObject } from "ajv";

const require = createRequire(import.meta.url);
const Ajv = require("ajv") as { new (o?: object): import("ajv").Ajv };
const addFormats = require("ajv-formats") as (a: import("ajv").Ajv) => void;
import { getBenchmarkPackageDir, findDeepagentsjsRoot } from "./paths.js";
import { loadJsonl } from "./load-benchmark.js";

const packDir = getBenchmarkPackageDir();
const schemaPath = join(packDir, "benchmark-entry.schema.json");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    `Usage: pnpm validate [--file <path-to.jsonl>]\nDefault: benchmark-v1.jsonl in this package (or from deepagentsjs root if found).\n`,
  );
  process.exit(0);
}

let fileArg = join(packDir, "benchmark-v1.jsonl");
const fIdx = args.indexOf("--file");
if (fIdx >= 0 && args[fIdx + 1]) {
  const p = args[fIdx + 1]!;
  fileArg = p.startsWith("/") ? p : resolve(process.cwd(), p);
} else if (args[0] && !args[0].startsWith("-")) {
  const p = args[0];
  fileArg = p?.startsWith("/") ? p : resolve(process.cwd(), p!);
} else {
  try {
    const root = findDeepagentsjsRoot();
    fileArg = join(root, "libs/dataset/benchmark-tier-a/benchmark-v1.jsonl");
  } catch {
    fileArg = join(packDir, "benchmark-v1.jsonl");
  }
}

const schemaRaw = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<
  string,
  unknown
>;
delete schemaRaw.$schema;
const schema = schemaRaw as object;

const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
addFormats(ajv);
const validateEntry = ajv.compile(schema) as {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
};

function isHttpsUrl(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

function checkUrls(
  id: string,
  urls: string[] | undefined,
  label: string,
): string[] {
  const errs: string[] = [];
  for (const u of urls ?? []) {
    if (!isHttpsUrl(u)) {
      errs.push(`${id}: ${label} must use HTTPS: ${u}`);
    }
  }
  return errs;
}

async function main() {
  const entries = await loadJsonl(fileArg);
  const schemaErrors: string[] = [];
  const urlErrors: string[] = [];

  for (const e of entries) {
    if (!validateEntry(e)) {
      const errList = validateEntry.errors ?? [];
      const msg = errList
        .map(
          (er) =>
            `  - ${(er.instancePath || "/")} ${(er as ErrorObject & { message?: string }).message ?? "invalid"}`,
        )
        .join("\n");
      schemaErrors.push(`${e.id}:\n${msg}`);
    }
    urlErrors.push(
      ...checkUrls(e.id, e.primary_evidence_urls, "primary_evidence_urls"),
    );
  }

  const n = entries.length;
  console.log(`Validated ${n} entries in ${fileArg}`);

  if (schemaErrors.length) {
    console.error("\nJSON Schema failures:\n");
    for (const s of schemaErrors) console.error(s + "\n");
  }
  if (urlErrors.length) {
    console.error("\nHTTPS / URL issues:\n");
    for (const s of urlErrors) console.error(s);
  }

  if (schemaErrors.length || urlErrors.length) {
    process.exit(1);
  }
  console.log("OK: all entries match schema and use HTTPS for evidence URLs.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
