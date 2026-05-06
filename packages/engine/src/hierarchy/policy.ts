/**
 * Default tier × cost-class × skill policy. Mirrors §4 of the hierarchy
 * contracts spec. Hosts can swap this implementation for a DB-backed engine
 * when `pricing_catalog.tierAllowedClasses` differs from defaults.
 */
import type {
  CostClass,
  PolicyDecision,
  PolicyEngine,
  SkillRegistry,
  Tier,
} from "./types.js";

const DEFAULT_ALLOWED: Record<Tier, CostClass[]> = {
  anon: ["A"],
  free: ["A", "B"],
  paid: ["A", "B", "C"],
  premium: ["A", "B", "C", "D"],
};

const TIER_ORDER: Record<Exclude<Tier, "anon">, number> = {
  free: 1,
  paid: 2,
  premium: 3,
};

export interface DefaultPolicyOptions {
  allowedClasses?: Partial<Record<Tier, CostClass[]>>;
  registry?: SkillRegistry;
}

export class DefaultPolicyEngine implements PolicyEngine {
  private allowed: Record<Tier, CostClass[]>;

  constructor(private readonly options: DefaultPolicyOptions = {}) {
    this.allowed = { ...DEFAULT_ALLOWED, ...(options.allowedClasses ?? {}) } as Record<Tier, CostClass[]>;
  }

  checkTool(input: {
    tier: Tier;
    toolName: string;
    costClass: CostClass;
  }): PolicyDecision {
    const allowed = this.allowed[input.tier] ?? [];
    if (allowed.includes(input.costClass)) return { allowed: true };

    // For anon callers we deny outright.
    if (input.tier === "anon") {
      return { allowed: false, reason: `anon callers cannot run ${input.costClass} tools` };
    }

    // For free/paid trying a premium tool, downgrade to the highest allowed class.
    const downgradedTo = [...allowed].sort().pop() as CostClass | undefined;
    return {
      allowed: false,
      reason: `tier ${input.tier} cannot run ${input.costClass} tools`,
      downgradedTo,
    };
  }

  checkSkill(input: { tier: Tier; skillId: string }): PolicyDecision {
    const registry = this.options.registry;
    if (!registry) {
      // Without a registry we can't gate skills meaningfully; allow.
      return { allowed: true };
    }
    const skill = registry.byId(input.skillId);
    if (!skill) {
      return { allowed: false, reason: `unknown skill ${input.skillId}` };
    }
    if (!skill.enabled) {
      return { allowed: false, reason: `skill ${input.skillId} disabled` };
    }
    if (input.tier === "anon") {
      return { allowed: false, reason: "anon callers cannot use registered skills" };
    }
    const min = skill.minTier ?? "free";
    if (TIER_ORDER[input.tier] < TIER_ORDER[min]) {
      return {
        allowed: false,
        reason: `skill ${input.skillId} requires tier ${min}`,
      };
    }

    // Cost class also matters: a premium-only skill (D) cannot be used by paid.
    const allowedClasses = this.allowed[input.tier] ?? [];
    if (!allowedClasses.includes(skill.costClass)) {
      return {
        allowed: false,
        reason: `tier ${input.tier} cannot run cost class ${skill.costClass}`,
      };
    }

    return { allowed: true };
  }
}
