import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { createAllSubAgents, SUB_AGENT_CONFIGS, SubAgent } from "./sub-agents.js";
import { ASSTPersistenceSQLite } from "./persistence/sqlite.js";
import {
  createModel,
  DEFAULT_ORCHESTRATOR_MODEL,
} from "./config/model-factory.js";

export interface OrchestratorOptions {
  /**
   * Model identifier in the "<provider>:<model>[@<baseUrl>]" format
   * (see config/model-factory.ts). Defaults to $ASST_ORCHESTRATOR_MODEL or
   * google:gemini-2.5-flash.
   */
  model?: string;
}

const ORCHESTRATOR_SYSTEM_PROMPT_TEMPLATE = (repoRoot: string) => `You are ARES Orchestrator — Automated Resilience Evaluation System for Solana security intelligence.

## CRITICAL — Current Repository Path:
The user's repository is located at: ${repoRoot}
ALWAYS use this exact path when delegating tasks. NEVER use any other path from conversation history.

You do NOT use tools directly. Instead, you REASON about the user's request and DELEGATE to specialized sub-agents.

## Available Sub-Agents:
${SUB_AGENT_CONFIGS.map(c => `- **${c.name}**: ${c.description}`).join("\n")}

## Your Workflow:
1. ANALYZE the user's request
2. DECIDE which sub-agent(s) to invoke (you can invoke multiple)
3. RESPOND with a JSON array of tasks in this exact format:

\`\`\`json
[
  {"agent": "agent_name", "task": "specific instructions for this agent"},
  {"agent": "agent_name", "task": "specific instructions for this agent"}
]
\`\`\`

## Rules:
- Always include "report_synthesizer" as the LAST agent when the user wants analysis or a report
- For general chat/questions, respond with just a "report_synthesizer" agent whose task demands a **short** reply (a few sentences or bullets). Avoid long brochures and tables unless the user asks for detail or an audit-style summary.
- For full scans, invoke ALL relevant agents
- ALWAYS pass the repository path ${repoRoot} to each agent's task
- Be specific in your task descriptions — tell each agent exactly what to analyze

## Examples:
- "scan my repo" → invoke all 6 agents
- "check for rug pull patterns on token X" → invoke rug_pull_detector + report_synthesizer  
- "find secrets in this repo" → invoke secret_hygiene_scanner + report_synthesizer
- "hi, what can you do?" → invoke report_synthesizer with task to introduce capabilities`;

/** Tiny greetings/pings: answered locally so report_synthesizer does not hallucinate PDF/report pipelines. */
function casualPingReply(input: string): string | null {
  const t = input.trim();
  if (!t || t.length > 120) return null;

  if (/^(hi|hello|hey|yo|testing|test|ping|pong)\b[!?.…\s]*$/iu.test(t)) {
    return "Hi — I'm here. Tell me what to audit, or paste a GitHub repo URL for a scan.";
  }

  if (
    /\bwho\s+are\s+you\b/i.test(t) ||
    /\bwhat\s+are\s+you\b/i.test(t) ||
    /\byour\s+name\b/i.test(t)
  ) {
    return [
      "I'm **ARES** (Autonomous Resilience Evaluation System) — a security-assistant stack for codebases with a Solana/security lens.",
      "I can **chat**, **queue repo scans**, and **summarize findings** once runs finish. Paste a GitHub URL to scan or ask something specific.",
    ].join("\n\n");
  }

  if (
    /\bwhat\s+(can|do)\s+you\s+do\b/i.test(t) ||
    /\bcapabilit(y|ies)\b/i.test(t)
  ) {
    return [
      "I help with **security posture**: repo scans (secrets, deps, Solana-oriented checks when relevant), queued full scans, and synthesizing findings into readable summaries.",
      "Paste a **repo URL** or ask something specific (e.g. \"scan this repo …\"). For deep dives, open **Runs** after enqueue.",
    ].join("\n\n");
  }

  return null;
}

export class Orchestrator {
  private llm: any;
  private subAgents: Map<string, SubAgent>;
  private persistence: ASSTPersistenceSQLite;
  private repoRoot: string;
  private initPromise?: Promise<void>;
  public readonly model: string;

  constructor(repoRoot: string, opts: OrchestratorOptions = {}) {
    this.repoRoot = repoRoot;
    this.persistence = new ASSTPersistenceSQLite(repoRoot);
    this.model = opts.model ?? DEFAULT_ORCHESTRATOR_MODEL;

    // createModel throws a descriptive error if the required key is missing.
    this.llm = createModel(this.model, { temperature: 0.1 });

    this.subAgents = createAllSubAgents(repoRoot);
  }

  /**
   * Initialize persistence. Safe to call multiple times (idempotent) —
   * subsequent calls reuse the in-flight or resolved promise so `chat()`
   * and `runFullScan()` can call it lazily without racing the CLI's
   * explicit `await orchestrator.init()`.
   */
  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.persistence.init();
    }
    return this.initPromise;
  }

  /**
   * Process a user message through the orchestrator → sub-agents pipeline.
   */
  async chat(
    input: string,
    onStatus?: (msg: string) => void
  ): Promise<string> {
    await this.init();
    await this.persistence.addHistory("user", input);

    const ping = casualPingReply(input);
    if (ping) {
      await this.persistence.addHistory("agent", ping);
      return ping;
    }

    // Step 1: Ask orchestrator to route
    onStatus?.("Orchestrator is reasoning...");
    const routing = await this.route(input);

    if (!routing || routing.length === 0) {
      const fallback = "I couldn't determine how to process that request. Could you be more specific?";
      await this.persistence.addHistory("agent", fallback);
      return fallback;
    }

    // Step 2: Execute sub-agents — independent agents run in parallel
    const results: { agent: string; output: string }[] = [];
    
    // Separate independent tasks from the report synthesizer
    const independentTasks = routing.filter(t => t.agent !== "report_synthesizer");
    const synthesizerTask = routing.find(t => t.agent === "report_synthesizer");

    // Run independent agents in parallel
    if (independentTasks.length > 0) {
      onStatus?.(`Running ${independentTasks.length} agents in parallel...`);
      
      const parallelResults = await Promise.allSettled(
        independentTasks.map(async (task) => {
          const subAgent = this.subAgents.get(task.agent);
          if (!subAgent) {
            return { agent: task.agent, output: `[Error] Sub-agent "${task.agent}" not found.` };
          }
          onStatus?.(`${subAgent.config.name} is analyzing...`);
          const taskPrompt = `Repository: ${this.repoRoot}\n\nTask: ${task.task}`;
          const output = await subAgent.invoke(taskPrompt);
          return { agent: task.agent, output };
        })
      );

      for (const result of parallelResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          results.push({ agent: "unknown", output: `[Error] ${result.reason?.message || result.reason}` });
        }
      }
    }

    // Run report synthesizer last (it depends on all prior results)
    if (synthesizerTask) {
      const subAgent = this.subAgents.get(synthesizerTask.agent);
      if (subAgent) {
        onStatus?.(`${subAgent.config.name} is synthesizing...`);
        try {
          let fullPrompt = `Repository: ${this.repoRoot}\n\nTask: ${synthesizerTask.task}`;
          if (results.length > 0) {
            const priorFindings = results
              .map((r) => `=== ${r.agent} ===\n${r.output}`)
              .join("\n\n");
            fullPrompt += `\n\n## Findings from other agents:\n${priorFindings}`;
          }
          const output = await subAgent.invoke(fullPrompt);
          results.push({ agent: synthesizerTask.agent, output });
        } catch (error: any) {
          results.push({ agent: synthesizerTask.agent, output: `[Error] ${error.message}` });
        }
      }
    }

    // Step 3: Return the last result (usually from report_synthesizer)
    const finalOutput = results[results.length - 1]?.output || "No output generated.";
    await this.persistence.addHistory("agent", finalOutput);
    return finalOutput;
  }

  /**
   * Ask the orchestrator LLM to decide which sub-agents to invoke.
   */
  private async route(input: string): Promise<{ agent: string; task: string }[]> {
    try {
      // Load recent history for multi-turn context
      const history = await this.persistence.getHistory(10);
      const historyMessages = history
        .reverse() // getHistory returns newest-first, we need chronological
        .map((h: any) =>
          h.role === "user"
            ? new HumanMessage(h.content)
            : new AIMessage(h.content)
        );

      const messages = [
        new SystemMessage(ORCHESTRATOR_SYSTEM_PROMPT_TEMPLATE(this.repoRoot)),
        ...historyMessages,
        new HumanMessage(input)
      ];

      const response = await this.llm.invoke(messages);
      const text = this.formatContent(response.content);

      // Extract JSON array from the response
      const jsonMatch = text.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        // If no JSON found, default to report_synthesizer for general chat
        return [{ agent: "report_synthesizer", task: input }];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (t: any) => typeof t.agent === "string" && typeof t.task === "string"
        );
      }

      return [{ agent: "report_synthesizer", task: input }];
    } catch (error: any) {
      console.error("Orchestrator routing error:", error.message);
      // Fallback: send everything to report_synthesizer
      return [{ agent: "report_synthesizer", task: input }];
    }
  }

  /**
   * Deterministic scan — runs ALL sub-agents in order (no LLM routing needed).
   */
  async runFullScan(
    onStatus?: (agent: string, status: string) => void
  ): Promise<{ agent: string; output: string }[]> {
    await this.init();
    const scanOrder = [
      "secret_hygiene_scanner",
      "solana_vulnerability_analyst",
      "defi_security_auditor",
      "rug_pull_detector",
      "supply_chain_analyst",
      "report_synthesizer"
    ];

    const results: { agent: string; output: string }[] = [];

    for (const agentName of scanOrder) {
      const subAgent = this.subAgents.get(agentName);
      if (!subAgent) continue;

      onStatus?.(agentName, "running");
      try {
        let taskPrompt = `Run a comprehensive ${subAgent.config.description} on the repository at: ${this.repoRoot}`;
        
        // Report synthesizer gets all prior results
        if (agentName === "report_synthesizer" && results.length > 0) {
          const priorFindings = results
            .map((r) => `=== ${r.agent} ===\n${r.output}`)
            .join("\n\n");
          taskPrompt = `Synthesize all findings below into a professional security assessment report for the repository at ${this.repoRoot}.\n\n${priorFindings}`;
        }

        const output = await subAgent.invoke(taskPrompt);
        results.push({ agent: agentName, output });
        onStatus?.(agentName, "done");
      } catch (error: any) {
        results.push({ agent: agentName, output: `[Error] ${error.message}` });
        onStatus?.(agentName, "error");
      }
    }

    return results;
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

  async close() {
    await this.persistence.close();
  }

  async getRecentHistory(limit = 20): Promise<{ role: string; content: string; timestamp: string }[]> {
    await this.init();
    const rows = await this.persistence.getHistory(limit);
    return rows.map((row: any) => ({
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
    }));
  }
}
