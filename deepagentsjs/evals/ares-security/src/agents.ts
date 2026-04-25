import { ChatAnthropic } from "@langchain/anthropic";
import { createDeepAgent, type DeepAgent, type SubAgent } from "deepagents";

import {
  type BenchmarkConfig,
  type BenchmarkHarness,
} from "./protocol.js";
import { ANALYZER, EXPLORER, getOrchestratorSystemPrompt, REVIEWER } from "./prompts.js";
import { rustcCheckTool } from "./tools/rustc.js";

function makeModel(cfg: BenchmarkConfig) {
  if (cfg.modelName.includes("claude")) {
    return new ChatAnthropic({
      model: cfg.modelName,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    });
  }
  return cfg.modelName;
}

const teamSubagents: SubAgent[] = [
  {
    name: "analyzer",
    description:
      "Reads Anchor/Rust code and summarizes vulnerability-relevant structure and invariants. Use first.",
    systemPrompt: ANALYZER,
    tools: [],
  },
  {
    name: "explorer",
    description:
      "Builds a concrete PoC (Rust sketch or instruction-level) from the code and analyst notes. Use after analyzer.",
    systemPrompt: EXPLORER,
    tools: [],
  },
  {
    name: "reviewer",
    description:
      "Validates PoC and remediation; returns review notes. Use after explorer before final JSON.",
    systemPrompt: REVIEWER,
    tools: [],
  },
];

function useTeam(h: BenchmarkHarness): boolean {
  return h === "team" || h === "team_rich";
}

/**
 * Security benchmark agent: static baseline, or team harness (SubAgentMiddleware / task tool).
 */
export function createSecurityBenchmarkAgent(cfg: BenchmarkConfig): DeepAgent {
  const model = makeModel(cfg);
  const systemPrompt = getOrchestratorSystemPrompt(cfg.harness);
  if (useTeam(cfg.harness)) {
    return createDeepAgent({
      model,
      systemPrompt,
      subagents: teamSubagents,
      /** In-harness rich feedback: coordinator can `rustc_check` PoC / remediation. */
      tools: [rustcCheckTool],
    });
  }
  return createDeepAgent({
    model,
    systemPrompt,
  });
}
