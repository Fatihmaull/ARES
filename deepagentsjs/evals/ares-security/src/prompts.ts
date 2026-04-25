import { DEFAULT_PROMPT, type BenchmarkHarness, type VulnerabilityCase } from "./protocol.js";

/**
 * User message for static / rich single-agent modes (unchanged behavior vs legacy DEFAULT_PROMPT).
 */
export function buildStaticUserMessage(testCase: VulnerabilityCase): string {
  return `Code: \n${testCase.code}`;
}

const TEAM_ORCHESTRATOR = `You are the orchestrator for a three-role Solana security team. You have the **rustc_check** tool on the coordinator: use it to validate Rust snippets (syntax) for PoC and remediation. Unresolved imports to Anchor are expected; focus on syntax. You MUST use the **task** tool to delegate in order:

1. **analyzer** — Read the program and summarize attack surface, invariants, and where bugs may hide.
2. **explorer** — Propose a concrete PoC (instruction sequence / Rust sketch) targeting the analyst's notes. Optionally rustc_check the explorer output.
3. **reviewer** — Check the PoC and suggested remediation; rustc_check remediation if useful.

After the team finishes, YOU must output a single final answer: a JSON object only (no markdown fence), with keys "findings", "poc", "remediation" as specified below.

## Output shape (required)
{
  "findings": [ { "type", "severity", "location": { "file", "line" }, "description", "cwe", "cvss" } ],
  "poc": "// Rust or instruction-level PoC",
  "remediation": "// fixed code or instructions"
}

Do not skip delegation unless a role is truly unnecessary; default is to run all three.`;

const ANALYZER = `You are the Analyzer sub-agent. You only analyze Anchor/Rust Solana code: structure, signers, CPI, arithmetic, and access control. Return concise bullet findings for the Explorer. Do not output the final JSON benchmark format — that is the orchestrator's job.`;

const EXPLORER = `You are the Explorer sub-agent. Given the code and analyst notes, produce a concrete proof-of-concept: Rust-like pseudocode or instruction description that would demonstrate the issue. Pass your PoC to the Reviewer. Do not emit the final benchmark JSON.`;

const REVIEWER = `You are the Reviewer sub-agent. Validate the proposed PoC against the code; suggest fixes. Do not emit the final benchmark JSON — return review notes to the orchestrator.`;

export function getOrchestratorSystemPrompt(harness: BenchmarkHarness): string {
  if (harness === "team" || harness === "team_rich") {
    return TEAM_ORCHESTRATOR;
  }
  return DEFAULT_PROMPT;
}

export { ANALYZER, EXPLORER, REVIEWER };
