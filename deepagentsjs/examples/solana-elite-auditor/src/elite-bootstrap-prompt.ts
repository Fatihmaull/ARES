/**
 * First-turn instructions for a full-program Solana assurance pass.
 * Complements static rubric in ../ELITE-SOLANA-AUDITOR.md.
 */
export function buildEliteAuditUserMessage(repoRoot: string, extra?: string): string {
  const tail = extra?.trim() ? `\n\nAdditional operator context:\n${extra.trim()}` : "";
  return [
    `Repository root (absolute path to use in all tool tasks): ${repoRoot}`,
    "",
    "Run a full ARES-style Solana security assessment:",
    "1. Delegate to solana_vulnerability_analyst — Anchor/Rust: account validation, signer checks, PDA seeds, CPI boundaries, oracle usage, arithmetic hot spots.",
    "2. Delegate to defi_security_auditor — upgrade authority, admin surfaces, CPI graphs, account snapshots.",
    "3. Delegate to rug_pull_detector when SPL/token or liquidity context exists.",
    "4. Delegate to secret_hygiene_scanner — secrets, .env hygiene, git history.",
    "5. Delegate to supply_chain_analyst — assurance manifest / static lane outputs as applicable.",
    "6. Finish with report_synthesizer — unified posture summary; if structured findings exist, use generate_pdf_report with severity, title, layer, tool, description, remediation.",
    "",
    "Evidence rules: cite file paths and line numbers or on-chain addresses; label severity Critical/High/Medium/Low/Informational; flag uncertain items as hypotheses.",
    "Optional: suggest Hypothesis/Property-Based Testing follow-ups (see agentic-pbt-style properties) for high-risk pure functions — do not claim tests were executed unless tools did.",
    tail,
  ].join("\n");
}
