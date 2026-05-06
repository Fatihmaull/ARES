/**
 * Hierarchy contracts (5-tier) per
 * docs/design/agent-hierarchy-contracts-v1.md.
 *
 * The classes are billing- and wallet-agnostic: every layer accepts a
 * `RunContext` and emits trace events through `ctx.emit`. Web/worker plumb
 * those events to Postgres + structured logs.
 */

export type Domain = "blockchain" | "web" | "ai" | "reverse_engineering";
export type CostClass = "A" | "B" | "C" | "D";
export type Layer =
  | "orchestrator"
  | "supervisor"
  | "coordinator"
  | "sub_agent"
  | "worker";
export type Tier = "anon" | "free" | "paid" | "premium";

export interface RunContext {
  requestId: string;
  runId: string;
  /** Soft cost hint surfaced by the orchestrator; planner may reject above this. */
  budgetUnits: number;
  /** Cost classes the policy engine has approved for this caller. */
  allowedCostClasses: CostClass[];
  tier: Tier;
  emit: (event: TraceEvent) => void;
  abortSignal: AbortSignal;
}

export interface TraceEvent {
  ts: number;
  layer: Layer;
  agent: string;
  kind:
    | "plan"
    | "dispatch"
    | "tool_start"
    | "tool_end"
    | "result"
    | "error"
    | "cost_estimate"
    | "policy_block";
  message?: string;
  meta?: Record<string, unknown>;
  costClassHint?: CostClass;
}

export interface PlanStep {
  domain: Domain;
  task: string;
  preferredSkills?: string[];
  estimatedUnits: number;
  parallelGroup?: string;
}

export interface Plan {
  steps: PlanStep[];
  finalSynthesisAgent?: string;
}

export interface AgentResult {
  agent: string;
  layer: Layer;
  output: string;
  artifacts: unknown[];
  unitsUsed: number;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
}

export interface Orchestrator {
  run(input: string, ctx: RunContext): Promise<{
    finalOutput: string;
    perStep: AgentResult[];
    totalUnitsUsed: number;
  }>;
}

export interface Supervisor {
  domain: Domain;
  handle(step: PlanStep, ctx: RunContext): Promise<AgentResult>;
}

export interface Coordinator {
  dispatch(step: PlanStep, ctx: RunContext): Promise<AgentResult>;
}

export interface SubAgentNode {
  name: string;
  skills: readonly string[];
  invoke(input: string, ctx: RunContext): Promise<AgentResult>;
}

export interface WorkerNode {
  name: string;
  costClass: CostClass;
  invoke(input: unknown, ctx: RunContext): Promise<unknown>;
}

export interface SkillMeta {
  id: string;
  domain: Domain;
  costClass: CostClass;
  ownerSubAgent: string;
  enabled: boolean;
  minTier?: Exclude<Tier, "anon">;
}

export interface SkillRegistry {
  list(): SkillMeta[];
  byId(id: string): SkillMeta | undefined;
  byDomain(domain: Domain): SkillMeta[];
  bySubAgent(subAgent: string): SkillMeta[];
}

export interface CapabilityGraph {
  resolve(
    preferredSkills: string[],
    domain: Domain,
  ): { subAgent: string; matchedSkills: string[] };
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  downgradedTo?: CostClass;
}

export interface PolicyEngine {
  checkTool(input: {
    tier: Tier;
    toolName: string;
    costClass: CostClass;
  }): PolicyDecision;
  checkSkill(input: { tier: Tier; skillId: string }): PolicyDecision;
}

export interface CostAwarePlanner {
  apply(plan: Plan, ctx: RunContext): { plan: Plan; rejected: PlanStep[] };
}
