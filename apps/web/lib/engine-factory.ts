/**
 * Engine factory for the Next.js web surface.
 *
 * The web app is **public** (or will be), so by default it must not expose
 * tools that can mutate the filesystem or spawn subprocesses.
 *
 * All API routes should call `createPublicOrchestrator()` rather than
 * instantiating `Orchestrator` directly, so security policy lives in one
 * place.
 *
 * Environment:
 *   ASST_WEB_ALLOW_WRITE — explicit opt-in to mount mutating tools on the
 *                          web surface. Default: disabled.
 *   ASST_ORCHESTRATOR_MODEL — e.g. "google:gemini-2.5-flash",
 *                          "ollama:llama3.1". Defaults resolved inside the
 *                          engine.
 */
import { Orchestrator } from "@ares/engine";
import { resolveRepoRoot } from "./paths";

export interface PublicOrchestratorOptions {
  repoRoot?: string;
  model?: string;
}

if (process.env.ASST_WEB_ALLOW_WRITE !== "1") {
  process.env.ASST_ALLOW_WRITE = "0";
}

export function createPublicOrchestrator(opts: PublicOrchestratorOptions = {}) {
  const repoRoot = opts.repoRoot ?? resolveRepoRoot();

  // In local development we want chat routes to work even when the default
  // provider (Google) is gated/disabled. Prefer an explicit env override,
  // otherwise fall back to a cheap OpenRouter model.
  const model =
    opts.model ??
    process.env.ASST_ORCHESTRATOR_MODEL ??
    "openrouter:nvidia/nemotron-nano-9b-v2:free";
  return new Orchestrator(repoRoot, { model });
}
