import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

import { getCompileFeedback } from "./compile-feedback.js";
import { isRichHarness } from "./protocol.js";
import type { BenchmarkConfig, EvaluationResult, VulnerabilityCase } from "./protocol.js";
import { buildStaticUserMessage } from "./prompts.js";
import { parseAgentResponse, scoreResponse } from "./scorer.js";
import type { DeepAgent } from "deepagents";

function lastAssistantText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.getType() === "ai") {
      const c = m.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) {
        return c
          .map((p) => (typeof p === "object" && p && "text" in p ? (p as { text: string }).text : String(p)))
          .join("");
      }
      return String(c);
    }
  }
  return "";
}

/**
 * Run one benchmark case: optional multi-turn compile feedback, then score.
 */
export async function evaluateCase(
  testCase: VulnerabilityCase,
  agent: DeepAgent,
  cfg: BenchmarkConfig
): Promise<{ result: EvaluationResult }> {
  const t0 = Date.now();
  const rich = isRichHarness(cfg.harness);
  const compileOn =
    rich && cfg.compileCheck !== "off" ? cfg.compileCheck : "off";

  let messages: BaseMessage[] = [new HumanMessage(buildStaticUserMessage(testCase))];
  let feedbackRounds = 0;
  const compileLog: string[] = [];

  let out = await agent.invoke({ messages });
  messages = out.messages as BaseMessage[];
  let responseText = lastAssistantText(messages);

  while (rich && compileOn !== "off" && feedbackRounds < cfg.maxFeedbackRounds) {
    const parsed = parseAgentResponse(responseText);
    const fb = getCompileFeedback(
      parsed.poc,
      testCase.code,
      compileOn,
      cfg.anchorWorkspace
    );
    if (fb.skipped) {
      break;
    }
    if (fb.ok) {
      break;
    }
    compileLog.push(fb.stderr);
    feedbackRounds += 1;
    messages = [
      ...messages,
      new HumanMessage(
        `The PoC (or program under test) did not pass the check (${fb.command || "check"}). ` +
          `Fix the PoC and output the full JSON again with "findings", "poc", and "remediation".\n\n` +
          `--- compiler / checker output ---\n${fb.stderr}\n--- end ---`
      ),
    ];
    out = await agent.invoke({ messages });
    messages = out.messages as BaseMessage[];
    responseText = lastAssistantText(messages);
  }

  const parsed = parseAgentResponse(responseText);
  const scored = scoreResponse(parsed, testCase);
  scored.elapsedMs = Date.now() - t0;
  scored.harness = cfg.harness;
  scored.feedbackRounds = feedbackRounds;
  if (compileLog.length > 0) {
    scored.compileLog = compileLog;
  }

  return { result: scored };
}
