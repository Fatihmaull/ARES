/**
 * Concrete L2/L3/L4 nodes. SubAgentNode wraps the existing flat `SubAgent`
 * (per spec §7) so we don't rewrite tool execution; we just add the layered
 * dispatch + tracing surface above it.
 */
import { SubAgent } from "../sub-agents.js";
import type {
  AgentResult,
  CapabilityGraph,
  Coordinator,
  Domain,
  PlanStep,
  PolicyEngine,
  RunContext,
  SubAgentNode,
  Supervisor,
} from "./types.js";

export interface SupervisorOptions {
  domain: Domain;
  coordinator: Coordinator;
}

export class StandardSupervisor implements Supervisor {
  readonly domain: Domain;
  private readonly coordinator: Coordinator;

  constructor(opts: SupervisorOptions) {
    this.domain = opts.domain;
    this.coordinator = opts.coordinator;
  }

  async handle(step: PlanStep, ctx: RunContext): Promise<AgentResult> {
    ctx.emit({
      ts: Date.now(),
      layer: "supervisor",
      agent: `supervisor:${this.domain}`,
      kind: "dispatch",
      meta: { task: step.task, preferredSkills: step.preferredSkills },
    });
    return this.coordinator.dispatch(step, ctx);
  }
}

export interface CoordinatorOptions {
  capabilityGraph: CapabilityGraph;
  policy: PolicyEngine;
  /** Provided by the host; used to invoke the actual sub-agent. */
  resolveSubAgentNode: (subAgentName: string) => SubAgentNode | undefined;
}

export class StandardCoordinator implements Coordinator {
  constructor(private readonly opts: CoordinatorOptions) {}

  async dispatch(step: PlanStep, ctx: RunContext): Promise<AgentResult> {
    const { subAgent, matchedSkills } = this.opts.capabilityGraph.resolve(
      step.preferredSkills ?? [],
      step.domain,
    );

    ctx.emit({
      ts: Date.now(),
      layer: "coordinator",
      agent: `coordinator:${step.domain}`,
      kind: "plan",
      meta: { selectedSubAgent: subAgent, matchedSkills },
    });

    // Skill policy check (for any skill the supervisor pinned).
    for (const skillId of step.preferredSkills ?? []) {
      const decision = this.opts.policy.checkSkill({ tier: ctx.tier, skillId });
      if (!decision.allowed) {
        ctx.emit({
          ts: Date.now(),
          layer: "coordinator",
          agent: `coordinator:${step.domain}`,
          kind: "policy_block",
          message: decision.reason,
          meta: { skillId },
        });
        return {
          agent: subAgent,
          layer: "coordinator",
          output: `[policy_block] ${decision.reason ?? "skill not allowed"}`,
          artifacts: [],
          unitsUsed: 0,
          durationMs: 0,
          ok: false,
          errorMessage: decision.reason ?? "skill not allowed",
        };
      }
    }

    const node = this.opts.resolveSubAgentNode(subAgent);
    if (!node) {
      const reason = `sub-agent not found: ${subAgent}`;
      return {
        agent: subAgent,
        layer: "coordinator",
        output: `[error] ${reason}`,
        artifacts: [],
        unitsUsed: 0,
        durationMs: 0,
        ok: false,
        errorMessage: reason,
      };
    }

    return node.invoke(step.task, ctx);
  }
}

export interface FlatSubAgentNodeOptions {
  name: string;
  delegate: SubAgent;
}

/**
 * Wraps an existing flat SubAgent as the L4 node. The SubAgent class
 * already runs LangChain tools (the L5 layer), so we don't add anything
 * heavy here; we just adapt the result envelope and emit the right traces.
 */
export class FlatSubAgentNode implements SubAgentNode {
  readonly name: string;
  readonly skills: readonly string[];
  private readonly delegate: SubAgent;

  constructor(opts: FlatSubAgentNodeOptions) {
    this.name = opts.name;
    this.delegate = opts.delegate;
    this.skills = opts.delegate.config.skills;
  }

  async invoke(input: string, ctx: RunContext): Promise<AgentResult> {
    const start = Date.now();
    ctx.emit({
      ts: start,
      layer: "sub_agent",
      agent: this.name,
      kind: "tool_start",
    });
    try {
      const detailed = await this.delegate.invokeWithArtifacts(input);
      const ts = Date.now();
      ctx.emit({
        ts,
        layer: "sub_agent",
        agent: this.name,
        kind: "result",
        meta: { artifactCount: detailed.artifacts.length },
      });
      return {
        agent: this.name,
        layer: "sub_agent",
        output: detailed.output,
        artifacts: detailed.artifacts,
        unitsUsed: 1, // placeholder until cost-aware planner extends
        durationMs: ts - start,
        ok: true,
      };
    } catch (err) {
      const ts = Date.now();
      const errorMessage = err instanceof Error ? err.message : String(err);
      ctx.emit({
        ts,
        layer: "sub_agent",
        agent: this.name,
        kind: "error",
        message: errorMessage,
      });
      return {
        agent: this.name,
        layer: "sub_agent",
        output: `[error] ${errorMessage}`,
        artifacts: [],
        unitsUsed: 0,
        durationMs: ts - start,
        ok: false,
        errorMessage,
      };
    }
  }
}
