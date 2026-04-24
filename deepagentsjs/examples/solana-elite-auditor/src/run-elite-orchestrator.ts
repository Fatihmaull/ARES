/**
 * Canonical elite audit entry: @ares/engine Orchestrator (multi-agent swarm, skills, PDF tool).
 *
 * Env: ASST_ORCHESTRATOR_MODEL (optional), provider keys per packages/engine model factory.
 */
import "dotenv/config";
import { resolve } from "node:path";
import { Orchestrator } from "@ares/engine";
import { buildEliteAuditUserMessage } from "./elite-bootstrap-prompt.js";

const repoRoot = resolve(process.argv[2] ?? process.cwd());
const extra = process.argv.slice(3).join(" ");

async function main() {
  const orchestrator = new Orchestrator(repoRoot);
  await orchestrator.init();
  const msg = buildEliteAuditUserMessage(repoRoot, extra || undefined);
  const out = await orchestrator.chat(msg, (s) => console.error(`[status] ${s}`));
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
