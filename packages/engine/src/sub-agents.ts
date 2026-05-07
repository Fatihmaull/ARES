/**
 * Sub-agent registry.
 *
 * Each entry declares: primary model, fallback models, associated skills, tools,
 * and a system-prompt prefix. Models are resolved via the model factory, so any
 * entry can be pointed at a local Ollama instance, an OpenRouter model, or a
 * hosted Google/OpenAI model by changing the identifier only.
 *
 * Model IDs follow the "<provider>:<model>" format (see config/model-factory.ts).
 * Legacy short-form IDs ("gemini-2.5-flash") still work via parseModelId.
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";

import { createModel } from "./config/model-factory.js";
import { loadSkills } from "./skills/loader.js";
import {
  buildSkillCatalog,
  loadSkillsForTask,
  type SkillCatalog,
} from "./skills/retrieval.js";
import { readFileTool } from "./tools/readonly.js";
import { createMutatingTools } from "./tools/mutating.js";
import { parseToolResult, type ToolResult } from "./findings/index.js";
import {
  solanaRpcReadTool,
  gitDiffSummaryTool,
  writeAssuranceManifestTool,
  programAccountAnalyzerTool,
  programUpgradeMonitorTool,
  cpiGraphMapperTool,
  accountStateSnapshotTool,
  secretScannerTool,
  envHygieneCheckTool,
  unifiedPostureReportTool,
  generatePdfReportTool,
  anchorSourceScannerTool,
  tokenConcentrationTool,
} from "./assurance-tools/index.js";

// ─── Sub-Agent Definitions ───────────────────────────────────────

export interface SubAgentConfig {
  name: string;
  description: string;
  /** Provider-prefixed model id (e.g. "google:gemini-2.5-flash"). */
  primaryModel: string;
  fallbackModels: string[];
  /** Skills always baked into the system prompt (vetted per sub-agent). */
  skills: string[];
  tools: any[];
  systemPromptPrefix: string;
  /**
   * Per-agent retrieval knob. When > 0, each invoke() call TF-IDF-ranks
   * the whole skill catalog against the incoming task and prepends the
   * top-K matches (minus already-pinned skills) to the user message.
   *
   * Defaults to the value of $ASST_SKILL_RETRIEVAL_TOPK (0 = off).
   */
  retrievalTopK?: number;
}

export const SUB_AGENT_CONFIGS: SubAgentConfig[] = [
  {
    name: "solana_vulnerability_analyst",
    description:
      "Analyzes Solana program code for vulnerabilities: Anchor constraints, PDA seeds, signer checks, CPI boundaries, oracle dependencies.",
    primaryModel: "openrouter:nvidia/nemotron-nano-9b-v2:free",
    fallbackModels: ["openrouter:openai/gpt-oss-20b:free"],
    skills: [
      "solana-defi-vulnerability-analyst-agent",
      "sealevel-attacks-solana",
      "neodyme-solana-security-workshop",
    ],
    tools: [
      programAccountAnalyzerTool,
      anchorSourceScannerTool,
      readFileTool,
      solanaRpcReadTool,
    ],
    systemPromptPrefix:
      "You are the Solana Vulnerability Analyst sub-agent. Your job is to analyze Solana programs for security vulnerabilities using your specialized tools and deep knowledge of Sealevel attack patterns.",
  },
  {
    name: "defi_security_auditor",
    description:
      "Audits DeFi protocols for admin takeover vectors, upgrade authority risks, flash loan patterns, governance centralization.",
    primaryModel: "openrouter:nvidia/nemotron-nano-9b-v2:free",
    fallbackModels: ["openrouter:openai/gpt-oss-20b:free"],
    skills: [
      "defi-security-audit-agent",
      "defi-admin-takeover-mitigation-lessons",
      "flash-loan-exploit-investigator-agent",
    ],
    tools: [
      cpiGraphMapperTool,
      programUpgradeMonitorTool,
      accountStateSnapshotTool,
      readFileTool,
    ],
    systemPromptPrefix:
      "You are the DeFi Security Auditor sub-agent. Your job is to audit DeFi protocols for centralization risks, admin takeover vectors, and flash loan vulnerabilities.",
  },
  {
    name: "rug_pull_detector",
    description:
      "Detects rug pull patterns: liquidity lock verification, LP distribution, transfer restrictions, dev wallet clustering.",
    primaryModel: "openrouter:nvidia/nemotron-nano-9b-v2:free",
    fallbackModels: [
      "openrouter:openai/gpt-oss-20b:free",
      "google:gemini-2.0-flash",
    ],
    skills: ["rug-pull-pattern-detection-agent", "honeypot-detection-techniques"],
    tools: [solanaRpcReadTool, accountStateSnapshotTool, tokenConcentrationTool],
    systemPromptPrefix:
      "You are the Rug Pull Detector sub-agent. Your job is to analyze tokens and protocols for rug pull patterns, honeypot mechanics, and liquidity risks.",
  },
  {
    name: "secret_hygiene_scanner",
    description:
      "Scans repositories for hardcoded secrets, environment hygiene issues, and git history leaks.",
    primaryModel: "openrouter:nvidia/nemotron-nano-9b-v2:free",
    fallbackModels: [
      "openrouter:openai/gpt-oss-20b:free",
      "google:gemini-2.0-flash",
    ],
    skills: ["on-chain-investigator-agent", "osec-solana-auditor-introduction"],
    tools: [secretScannerTool, envHygieneCheckTool, gitDiffSummaryTool],
    systemPromptPrefix:
      "You are the Secret & Hygiene Scanner sub-agent. Your job is to find hardcoded secrets, environment misconfigurations, and git history leaks in repositories.",
  },
  {
    name: "supply_chain_analyst",
    description:
      "Analyzes dependency supply chain: npm audit, static analysis, SARIF output, vulnerability manifests.",
    primaryModel: "openrouter:openai/gpt-oss-20b:free",
    fallbackModels: [
      "openrouter:nvidia/nemotron-nano-9b-v2:free",
      "google:gemini-2.0-flash",
    ],
    skills: [
      "blockchain-intelligence-fundamentals",
      "blockchain-analytics-operations",
    ],
    tools: [writeAssuranceManifestTool],
    systemPromptPrefix:
      "You are the Supply Chain Analyst sub-agent. Your job is to analyze dependency vulnerabilities, run static analysis, and produce structured security manifests.",
  },
  {
    name: "report_synthesizer",
    description:
      "Synthesizes findings from all sub-agents into a professional security report with severity ratings and remediation advice.",
    primaryModel: "openrouter:openai/gpt-oss-20b:free",
    fallbackModels: ["openrouter:nvidia/nemotron-nano-9b-v2:free"],
    skills: [
      "blockchain-intelligence-playbook",
      "cmichel-smart-contract-auditor-guide",
    ],
    tools: [unifiedPostureReportTool, generatePdfReportTool],
    systemPromptPrefix:
      "You are the Report Synthesizer sub-agent. Your primary job is to take raw findings from other security scanners and produce a professional security assessment report. ONLY generate a PDF report if you are explicitly given structured scan results or findings to process. For general conversation or queries without scan findings, do NOT use the generatePdfReportTool; simply answer the user dynamically in chat.",
  },
];

// ─── Sub-Agent Runtime ───────────────────────────────────────────

export class SubAgent {
  public config: SubAgentConfig;
  private agent: any;
  private repoRoot: string;
  /** Lazy, shared across invokes. Rebuilt automatically when SKILL.md files change. */
  private _catalog: SkillCatalog | undefined;
  private _catalogLoaded = false;

  constructor(config: SubAgentConfig, repoRoot: string) {
    this.config = config;
    this.repoRoot = repoRoot;
    this.initAgent(config.primaryModel);
  }

  private getCatalog(): SkillCatalog | undefined {
    if (!this._catalogLoaded) {
      this._catalog = buildSkillCatalog(this.repoRoot);
      this._catalogLoaded = true;
    }
    return this._catalog;
  }

  private resolveRetrievalTopK(): number {
    if (typeof this.config.retrievalTopK === "number") {
      return this.config.retrievalTopK;
    }
    const envVal = Number.parseInt(process.env.ASST_SKILL_RETRIEVAL_TOPK ?? "", 10);
    return Number.isFinite(envVal) ? Math.max(0, envVal) : 0;
  }

  /**
   * Build the retrieval-augmented user input for a given task. Pinned skills
   * are already in the system prompt, so we exclude them from retrieval.
   * Returns `input` unchanged if retrieval is disabled or no skills match.
   */
  private augmentWithRetrievedSkills(input: string): string {
    const topK = this.resolveRetrievalTopK();
    if (topK <= 0) return input;

    const catalog = this.getCatalog();
    if (!catalog) return input;

    const { text, used } = loadSkillsForTask(this.repoRoot, input, {
      catalog,
      topK,
      exclude: this.config.skills,
      maxChars: 12_000, // ~3k tokens, keeps per-call overhead bounded
    });
    if (!text || used.length === 0) return input;

    const names = used.map((s) => s.name).join(", ");
    return [
      `## Additional retrieved domain context (for this task only):`,
      text,
      `## Task (skills retrieved: ${names}):`,
      input,
    ].join("\n");
  }

  private initAgent(modelId: string) {
    const llm = createModel(modelId);
    const skillContent = loadSkills(this.repoRoot, this.config.skills);

    const systemPrompt = [
      this.config.systemPromptPrefix,
      "",
      "=== DOMAIN KNOWLEDGE ===",
      skillContent || "(No skills loaded)",
      "=== END DOMAIN KNOWLEDGE ===",
      "",
      "Use your tools to gather evidence. Always cite specific findings with file paths, line numbers, or account addresses. Classify severity as Critical / High / Medium / Low / Informational.",
    ].join("\n");

    this.agent = createReactAgent({
      llm,
      tools: this.config.tools,
      messageModifier: systemPrompt,
    });
  }

  async invoke(input: string): Promise<string> {
    const detailed = await this.invokeWithArtifacts(input);
    return detailed.output;
  }

  /**
   * Invoke the sub-agent and also collect any `ToolResult` envelopes that
   * its tools returned. This is the preferred entry point for hosts that
   * want structured findings (dashboards, CI gates, SARIF export).
   *
   * Tools whose output isn't a valid ToolResult are silently skipped —
   * `artifacts` only contains envelopes that successfully parsed.
   */
  async invokeWithArtifacts(
    input: string,
  ): Promise<{ output: string; artifacts: ToolResult[] }> {
    const augmentedInput = this.augmentWithRetrievedSkills(input);

    for (let attempt = 0; attempt <= this.config.fallbackModels.length; attempt++) {
      try {
        const result = await this.agent.invoke({
          messages: [new HumanMessage(augmentedInput)],
        });

        const artifacts: ToolResult[] = [];
        for (const msg of result.messages ?? []) {
          // LangChain tool messages arrive with `_getType?.() === "tool"`
          // or a `tool_call_id` property. Use both hints for robustness.
          const isToolMsg =
            (typeof msg._getType === "function" && msg._getType() === "tool") ||
            !!(msg as any).tool_call_id;
          if (!isToolMsg) continue;
          const parsed = parseToolResult(this.formatContent(msg.content));
          if (parsed) artifacts.push(parsed);
        }

        const lastMsg = result.messages[result.messages.length - 1];
        return { output: this.formatContent(lastMsg.content), artifacts };
      } catch (error: any) {
        const isRetryable =
          error?.message?.includes("429") ||
          error?.message?.includes("rate") ||
          error?.message?.includes("not found") ||
          error?.message?.includes("404");

        if (isRetryable && attempt < this.config.fallbackModels.length) {
          const fallback = this.config.fallbackModels[attempt];
          console.log(
            `  [${this.config.name}] Model busy, switching to ${fallback}...`,
          );
          this.initAgent(fallback);
          continue;
        }
        throw error;
      }
    }
    throw new Error(`All models exhausted for ${this.config.name}`);
  }

  private formatContent(content: any): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((p) => (typeof p === "string" ? p : p.text || ""))
        .join("")
        .trim();
    }
    return String(content || "");
  }
}

/**
 * Build all sub-agents for a given repo.
 *
 * Mutating tools (write_file, run_terminal_cmd) are NOT attached by default.
 * Surfaces that want them should extend the config list or call
 * `createMutatingTools()` and merge the returned tools into each sub-agent.
 */
export function createAllSubAgents(repoRoot: string): Map<string, SubAgent> {
  const agents = new Map<string, SubAgent>();
  for (const config of SUB_AGENT_CONFIGS) {
    agents.set(config.name, new SubAgent(config, repoRoot));
  }
  return agents;
}

// Re-export so hosts can build their own mutating tool bundles.
export { createMutatingTools };
