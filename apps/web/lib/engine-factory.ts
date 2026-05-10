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

function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function chooseDefaultModel(): string {
  if (process.env.ASST_ORCHESTRATOR_MODEL?.trim()) {
    return process.env.ASST_ORCHESTRATOR_MODEL.trim();
  }
  if (hasEnv("GOOGLE_API_KEY")) {
    return "google:gemini-2.5-flash";
  }
  if (hasEnv("OPENROUTER_API_KEY")) {
    return "openrouter:nvidia/nemotron-nano-9b-v2:free";
  }
  if (hasEnv("OPENAI_API_KEY") || hasEnv("ASST_OPENAI_API_KEY")) {
    return "openai:gpt-4o-mini";
  }
  if (hasEnv("ASST_LOCAL_BASE_URL") || hasEnv("OPENAI_BASE_URL")) {
    return "local:local-model";
  }
  return "ollama:llama3.1";
}

export function createPublicOrchestrator(opts: PublicOrchestratorOptions = {}) {
  const repoRoot = opts.repoRoot ?? resolveRepoRoot();
  const model = opts.model ?? chooseDefaultModel();
  return new Orchestrator(repoRoot, { model });
}
