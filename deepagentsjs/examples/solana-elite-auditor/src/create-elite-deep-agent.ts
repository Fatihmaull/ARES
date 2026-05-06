/**
 * Deep Agents harness for repo-local reasoning + filesystem — optional alternative to Orchestrator.
 * Uses Gemini when GOOGLE_API_KEY is set (aligns with common ARES engine defaults).
 */
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createDeepAgent, type SubAgent } from "deepagents";
import {
  anchorSourceScannerTool,
  gitDiffSummaryTool,
  secretScannerTool,
  envHygieneCheckTool,
  solanaRpcReadTool,
  programUpgradeMonitorTool,
  unifiedPostureReportTool,
  generatePdfReportTool,
} from "@ares/engine";

const ELITE_SYSTEM = `You are the ARES Elite Solana Auditor (Deep Agent harness).

You combine:
- Sealevel-specific reasoning (Anchor account types, CPI, signer discipline, PDA seeds, sysvar discipline)
- Evidence-first reporting (paths, lines, addresses)
- Operational security awareness (map notable findings to broader org controls when relevant)

Workflow:
1. Use filesystem tools to read program sources (programs/, src/, Anchor.toml).
2. Run anchor_source_scanner and other tools on the repo root the user provides.
3. For on-chain context, use the solana_rpc_read tool only with URLs the operator configured (SOLANA_RPC_URL).
4. Use unified_posture_report when assurance artifacts exist; use generate_pdf_report only when you have structured findings rows to pass in.

You are not a substitute for a human audit or formal verification; label gaps and false-positive risk explicitly.`;

export function createEliteSolanaDeepAgent(repoRoot: string) {
  const model = new ChatGoogleGenerativeAI({
    model: process.env.ASST_ELITE_DEEP_MODEL ?? "gemini-2.5-flash",
    temperature: 0.1,
  });

  const chainTools = [
    anchorSourceScannerTool,
    gitDiffSummaryTool,
    secretScannerTool,
    envHygieneCheckTool,
    solanaRpcReadTool,
    programUpgradeMonitorTool,
    unifiedPostureReportTool,
    generatePdfReportTool,
  ];

  const staticAnalyst: SubAgent = {
    name: "solana-static",
    description:
      "Focused pass: Anchor/Rust static heuristics and git summary under the repo root.",
    systemPrompt:
      "You run anchor_source_scanner and git_diff_summary. Output concise bullet findings with file:line when the scanner emits them.",
    tools: [anchorSourceScannerTool, gitDiffSummaryTool],
  };

  return createDeepAgent({
    name: "elite-solana-auditor",
    model,
    systemPrompt: `${ELITE_SYSTEM}\n\nDefault repo root for this session: ${repoRoot}`,
    tools: chainTools,
    subagents: [staticAnalyst],
  });
}
