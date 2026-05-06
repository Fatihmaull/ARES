/**
 * Hierarchical orchestrator (L1).
 *
 * Drives a domain plan through the 5-tier hierarchy:
 *   L1 Orchestrator (this) → L2 Supervisor → L3 Coordinator → L4 SubAgent → L5 Worker (LangChain tools).
 *
 * Existing callers (apps/web `chat()`, `runFullScan()`) keep working through
 * the original flat `Orchestrator`; this class is the new layered surface.
 */
import { createAllSubAgents, SUB_AGENT_CONFIGS } from "../sub-agents.js";
import {
  StandardCoordinator,
  StandardSupervisor,
  FlatSubAgentNode,
} from "./nodes.js";
import { DefaultCostAwarePlanner } from "./planner.js";
import { DefaultPolicyEngine } from "./policy.js";
import { StaticCapabilityGraph, StaticSkillRegistry } from "./registry.js";
import type {
  AgentResult,
  CapabilityGraph,
  CostAwarePlanner,
  Domain,
  Orchestrator,
  Plan,
  PolicyEngine,
  RunContext,
  SkillRegistry,
  SubAgentNode,
  Supervisor,
} from "./types.js";

export interface HierarchicalOrchestratorOptions {
  repoRoot: string;
  registry?: SkillRegistry;
  policy?: PolicyEngine;
  capabilityGraph?: CapabilityGraph;
  planner?: CostAwarePlanner;
}

export class HierarchicalOrchestrator implements Orchestrator {
  private readonly registry: SkillRegistry;
  private readonly policy: PolicyEngine;
  private readonly capabilityGraph: CapabilityGraph;
  private readonly planner: CostAwarePlanner;
  private readonly subAgentNodes: Map<string, SubAgentNode>;
  private readonly supervisors: Map<Domain, Supervisor>;

  constructor(opts: HierarchicalOrchestratorOptions) {
    this.registry = opts.registry ?? new StaticSkillRegistry();
    this.policy = opts.policy ?? new DefaultPolicyEngine({ registry: this.registry });
    this.capabilityGraph = opts.capabilityGraph ?? new StaticCapabilityGraph(this.registry);
    this.planner = opts.planner ?? new DefaultCostAwarePlanner();

    const flatSubAgents = createAllSubAgents(opts.repoRoot);
    this.subAgentNodes = new Map();
    for (const cfg of SUB_AGENT_CONFIGS) {
      const delegate = flatSubAgents.get(cfg.name);
      if (!delegate) continue;
      this.subAgentNodes.set(cfg.name, new FlatSubAgentNode({ name: cfg.name, delegate }));
    }

    const coordinator = new StandardCoordinator({
      capabilityGraph: this.capabilityGraph,
      policy: this.policy,
      resolveSubAgentNode: (name) => this.subAgentNodes.get(name),
    });

    this.supervisors = new Map();
    for (const domain of ["blockchain", "web", "ai", "reverse_engineering"] as const) {
      this.supervisors.set(domain, new StandardSupervisor({ domain, coordinator }));
    }
  }

  async run(input: string, ctx: RunContext): Promise<{
    finalOutput: string;
    perStep: AgentResult[];
    totalUnitsUsed: number;
  }> {
    // 1. Build a plan. v1 keeps it deterministic until LLM-driven planning is wired.
    const plan = this.planFromInput(input);
    ctx.emit({
      ts: Date.now(),
      layer: "orchestrator",
      agent: "hierarchical-orchestrator",
      kind: "plan",
      meta: { steps: plan.steps.length, finalSynthesisAgent: plan.finalSynthesisAgent },
    });

    // 2. Trim by budget.
    const { plan: trimmed, rejected } = this.planner.apply(plan, ctx);
    if (rejected.length > 0) {
      ctx.emit({
        ts: Date.now(),
        layer: "orchestrator",
        agent: "hierarchical-orchestrator",
        kind: "cost_estimate",
        meta: { rejected: rejected.length },
      });
    }

    // 3. Dispatch to supervisors per step.
    const results: AgentResult[] = [];
    let unitsUsed = 0;
    for (const step of trimmed.steps) {
      const supervisor = this.supervisors.get(step.domain);
      if (!supervisor) {
        results.push({
          agent: `supervisor:${step.domain}`,
          layer: "supervisor",
          output: `[error] no supervisor for ${step.domain}`,
          artifacts: [],
          unitsUsed: 0,
          durationMs: 0,
          ok: false,
          errorMessage: "no_supervisor",
        });
        continue;
      }
      try {
        const r = await supervisor.handle(step, ctx);
        results.push(r);
        unitsUsed += r.unitsUsed;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        results.push({
          agent: `supervisor:${step.domain}`,
          layer: "supervisor",
          output: `[error] ${errorMessage}`,
          artifacts: [],
          unitsUsed: 0,
          durationMs: 0,
          ok: false,
          errorMessage,
        });
      }
    }

    const finalOutput =
      results.length > 0 ? results[results.length - 1]!.output : "No output generated.";
    return { finalOutput, perStep: results, totalUnitsUsed: unitsUsed };
  }

  /**
   * v1 planner: pick a single step in the blockchain domain. Wired this way
   * deliberately to keep the surface compatible with the existing flat
   * orchestrator; LLM-driven multi-step planning lands in P5/Wave A.
   */
  private planFromInput(input: string): Plan {
    return {
      steps: [
        {
          domain: "blockchain",
          task: input,
          estimatedUnits: 1,
        },
      ],
      finalSynthesisAgent: "report_synthesizer",
    };
  }
}

/**
 * Helper used by hosts that just want a default-configured hierarchy.
 */
export function createHierarchicalOrchestrator(
  repoRoot: string,
): HierarchicalOrchestrator {
  return new HierarchicalOrchestrator({ repoRoot });
}
