# Agent Hierarchy Contracts v1

**Status:** LOCKED baseline for the 5-tier orchestrator refactor (blueprint §12).

**Related:** [ares-web-native-development-blueprint-consolidated.md](./ares-web-native-development-blueprint-consolidated.md), [architecture-contract-spec-v1.md](./architecture-contract-spec-v1.md), [billing-metering-spec-v1.md](./billing-metering-spec-v1.md), [wave-a-skill-manifest.md](./wave-a-skill-manifest.md).

---

## 1. Layer responsibilities

| Layer | Class | Owns | Hard NOs |
|-------|-------|------|----------|
| L1 | `Orchestrator` | Top-level intent → high-level plan, budget allocation, final response synthesis | Calling tools directly, owning wallet identity |
| L2 | `Supervisor` (per domain: Blockchain, Web, AI, ReverseEng) | Domain plan, picks coordinators, enforces domain policy | Cross-domain decisions |
| L3 | `Coordinator` | Decompose a domain task into worker-sized steps, parallel/serial dispatch, partial-failure handling | Holding session state across requests |
| L4 | `SubAgent` (existing 6, then Wave A adapters) | Domain executor with skills + tool list | Persisting global state |
| L5 | `Worker` | Single-tool / single-action execution; deterministic side effects | Multi-step reasoning |

**Invariant:** every layer is **billing- and wallet-agnostic** — they receive a `RunContext` containing `requestId`, `runId`, `costClassHints`, `budgetUnits`, but never touch ledger or auth (per architecture contract §1).

---

## 2. Core types (TypeScript)

```ts
// packages/engine/src/hierarchy/types.ts

export type Domain = "blockchain" | "web" | "ai" | "reverse_engineering";
export type CostClass = "A" | "B" | "C" | "D";
export type Layer = "orchestrator" | "supervisor" | "coordinator" | "sub_agent" | "worker";

export interface RunContext {
  requestId: string;
  runId: string;
  /** Soft cost hint surfaced by orchestrator; planner may reject above this. */
  budgetUnits: number;
  /** Per-tool cost class limits derived from tier policy (free → A,B; paid → A,B,C; premium → A–D). */
  allowedCostClasses: CostClass[];
  /** Tier of the calling wallet (or 'anon'). Set by web; engine reads only. */
  tier: "anon" | "free" | "paid" | "premium";
  /** Telemetry sink — emitted by every layer. */
  emit: (event: TraceEvent) => void;
  /** Cancellation surface (worker timeouts, user abort). */
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
  /** Optional skill-pinning — when set, supervisor must dispatch to a sub-agent that owns this skill. */
  preferredSkills?: string[];
  /** Best-effort estimate; planner uses this against `budgetUnits`. */
  estimatedUnits: number;
  parallelGroup?: string;
}

export interface Plan {
  steps: PlanStep[];
  finalSynthesisAgent?: string; // default "report_synthesizer"
}

export interface AgentResult {
  agent: string;
  layer: Layer;
  output: string;
  artifacts: unknown[]; // ToolResult[] from packages/engine/src/findings/
  unitsUsed: number;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
}

// L1
export interface Orchestrator {
  run(input: string, ctx: RunContext): Promise<{
    finalOutput: string;
    perStep: AgentResult[];
    totalUnitsUsed: number;
  }>;
}

// L2
export interface Supervisor {
  domain: Domain;
  handle(step: PlanStep, ctx: RunContext): Promise<AgentResult>;
}

// L3
export interface Coordinator {
  dispatch(step: PlanStep, ctx: RunContext): Promise<AgentResult>;
}

// L4
export interface SubAgentNode {
  name: string;
  skills: readonly string[];
  invoke(input: string, ctx: RunContext): Promise<AgentResult>;
}

// L5
export interface WorkerNode {
  name: string;
  costClass: CostClass;
  invoke(input: unknown, ctx: RunContext): Promise<unknown>;
}
```

---

## 3. Skill registry & capability graph

```ts
export interface SkillMeta {
  /** Directory name under .agents/skills/ */
  id: string;
  domain: Domain;
  costClass: CostClass;
  /** ID of the sub-agent that owns this skill at runtime. */
  ownerSubAgent: string;
  /** True only when wired by Wave A. Wave B/C will flip this for additional skills. */
  enabled: boolean;
  /** Tier gate (set by policy engine, NOT the registry). */
  minTier?: "free" | "paid" | "premium";
}

export interface SkillRegistry {
  list(): SkillMeta[];
  byId(id: string): SkillMeta | undefined;
  byDomain(domain: Domain): SkillMeta[];
  bySubAgent(subAgent: string): SkillMeta[];
}

/** Capability graph used by Coordinator to resolve `preferredSkills` → sub-agent. */
export interface CapabilityGraph {
  resolve(preferredSkills: string[], domain: Domain): { subAgent: string; matchedSkills: string[] };
}
```

The registry validates the `SKILL.md` files under `.agents/skills/` at boot and warns on duplicates / missing owners.

---

## 4. Policy engine

```ts
export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  /** When allowed but downgraded — e.g. block class D for free tier. */
  downgradedTo?: CostClass;
}

export interface PolicyEngine {
  /** Called by Coordinator before invoking a worker. */
  checkTool(input: {
    tier: RunContext["tier"];
    toolName: string;
    costClass: CostClass;
  }): PolicyDecision;
  /** Called by Supervisor before dispatching a step that requires a skill. */
  checkSkill(input: {
    tier: RunContext["tier"];
    skillId: string;
  }): PolicyDecision;
}
```

**Default rules:**

- `anon`: chat-only, deny all tools above class A, deny scans entirely.
- `free`: A and B allowed; C/D blocked.
- `paid`: A, B, C; D blocked unless premium SKU.
- `premium`: A–D.

---

## 5. Cost-aware planner

```ts
export interface CostAwarePlanner {
  /** Reject the plan or return a trimmed plan ≤ budget. */
  apply(plan: Plan, ctx: RunContext): { plan: Plan; rejected: PlanStep[] };
}
```

Planner **never** changes the formulas in [billing-metering-spec-v1.md](./billing-metering-spec-v1.md) §2. It only decides which steps to attempt; the actual debit is still issued by `apps/web` per request.

---

## 6. Run telemetry contract

Every `AgentResult` must be persisted via the worker (P3) into `runs` and `findings` tables (P1, migration `006`). Trace events are streamed to the structured logger and aggregated for cost-drift dashboards (P8).

Required fields on every event:

- `requestId`, `runId`, `layer`, `agent`, `ts`, `kind`.
- `costClassHint` for `dispatch` and `tool_start`.

---

## 7. Migration from flat sub-agents

The current six entries in [packages/engine/src/sub-agents.ts](../../packages/engine/src/sub-agents.ts) are wrapped — not rewritten — as `SubAgentNode` instances:

| Current | New layer | Domain | Notes |
|---------|-----------|--------|-------|
| `solana_vulnerability_analyst` | SubAgent | blockchain | Already class C; wrapped under Blockchain Supervisor |
| `defi_security_auditor` | SubAgent | blockchain | Class C |
| `rug_pull_detector` | SubAgent | blockchain | Class D |
| `secret_hygiene_scanner` | SubAgent | web | Class B |
| `supply_chain_analyst` | SubAgent | web | Class B |
| `report_synthesizer` | Orchestrator-owned synthesis pass | n/a | Stays last; not a coordinator |

Wave A skill onboarding (P5) extends the registry; it does **not** add new sub-agents in this phase.

---

## 8. Revision history

| Date | Change |
|------|--------|
| 2026-05-05 | Initial v1 |
