/**
 * Skill registry + capability graph (per docs/design/agent-hierarchy-contracts-v1.md).
 *
 * Wave A (P5) builds the seed list below. Wave B/C extend it without changing
 * shape. Each `enabled: true` row must have its `ownerSubAgent` present in
 * `SUB_AGENT_CONFIGS`; consumers that find a missing owner log a warning and
 * skip the skill at runtime.
 */
import { SUB_AGENT_CONFIGS } from "../sub-agents.js";
import type {
  CapabilityGraph,
  Domain,
  SkillMeta,
  SkillRegistry,
} from "./types.js";

/**
 * Wave A skill registry, in the order specified by
 * docs/design/wave-a-skill-manifest.md and docs/design/wave-a-onboarding-checklist.md.
 */
export const WAVE_A_SKILLS: readonly SkillMeta[] = [
  { id: "osec-solana-auditor-introduction", domain: "blockchain", costClass: "A", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "armaniferrante-x-status-solana-reference", domain: "blockchain", costClass: "A", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "cmichel-smart-contract-auditor-guide", domain: "blockchain", costClass: "A", ownerSubAgent: "defi_security_auditor", enabled: true, minTier: "free" },
  { id: "blockchain-intelligence-fundamentals", domain: "web", costClass: "A", ownerSubAgent: "supply_chain_analyst", enabled: true, minTier: "free" },
  { id: "crypto-investigation-compliance", domain: "web", costClass: "A", ownerSubAgent: "supply_chain_analyst", enabled: true, minTier: "free" },
  { id: "solana-tracing-specialist", domain: "blockchain", costClass: "B", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "solana-defi-vulnerability-analyst-agent", domain: "blockchain", costClass: "B", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "chainalysis-sanctions-screening", domain: "web", costClass: "B", ownerSubAgent: "supply_chain_analyst", enabled: true, minTier: "free" },
  { id: "honeypot-detection-techniques", domain: "blockchain", costClass: "B", ownerSubAgent: "rug_pull_detector", enabled: true, minTier: "free" },
  { id: "address-clustering-attribution", domain: "blockchain", costClass: "B", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "sealevel-attacks-solana", domain: "blockchain", costClass: "B", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
  { id: "flash-loan-exploit-investigator-agent", domain: "blockchain", costClass: "C", ownerSubAgent: "defi_security_auditor", enabled: true, minTier: "paid" },
  { id: "defi-security-audit-agent", domain: "blockchain", costClass: "C", ownerSubAgent: "defi_security_auditor", enabled: true, minTier: "paid" },
  { id: "rug-pull-pattern-detection-agent", domain: "blockchain", costClass: "D", ownerSubAgent: "rug_pull_detector", enabled: true, minTier: "premium" },
  { id: "solana-onchain-intelligence-resources", domain: "blockchain", costClass: "B", ownerSubAgent: "solana_vulnerability_analyst", enabled: true, minTier: "free" },
];

export class StaticSkillRegistry implements SkillRegistry {
  private byIdMap: Map<string, SkillMeta>;

  constructor(private readonly skills: readonly SkillMeta[] = WAVE_A_SKILLS) {
    const known = new Set(SUB_AGENT_CONFIGS.map((c) => c.name));
    for (const skill of skills) {
      if (skill.enabled && !known.has(skill.ownerSubAgent)) {
        // eslint-disable-next-line no-console
        console.warn(
          `[ares-hierarchy/registry] skill "${skill.id}" owned by unknown sub-agent "${skill.ownerSubAgent}" — disabling at runtime`,
        );
      }
    }
    this.byIdMap = new Map(skills.map((s) => [s.id, s]));
  }

  list(): SkillMeta[] {
    return [...this.skills];
  }

  byId(id: string): SkillMeta | undefined {
    return this.byIdMap.get(id);
  }

  byDomain(domain: Domain): SkillMeta[] {
    return this.skills.filter((s) => s.domain === domain);
  }

  bySubAgent(subAgent: string): SkillMeta[] {
    return this.skills.filter((s) => s.ownerSubAgent === subAgent);
  }
}

export class StaticCapabilityGraph implements CapabilityGraph {
  constructor(private readonly registry: SkillRegistry) {}

  resolve(
    preferredSkills: string[],
    domain: Domain,
  ): { subAgent: string; matchedSkills: string[] } {
    const candidates = preferredSkills
      .map((id) => this.registry.byId(id))
      .filter((s): s is SkillMeta => Boolean(s) && Boolean(s?.enabled) && s!.domain === domain);

    if (candidates.length === 0) {
      // Fall back to the first sub-agent that matches the domain by registry membership.
      const fallback = this.registry.byDomain(domain).find((s) => s.enabled);
      return {
        subAgent: fallback?.ownerSubAgent ?? defaultSubAgentForDomain(domain),
        matchedSkills: [],
      };
    }

    const counts = new Map<string, { count: number; ids: string[] }>();
    for (const c of candidates) {
      const entry = counts.get(c.ownerSubAgent) ?? { count: 0, ids: [] };
      entry.count += 1;
      entry.ids.push(c.id);
      counts.set(c.ownerSubAgent, entry);
    }
    let bestAgent = "";
    let bestCount = -1;
    let bestIds: string[] = [];
    for (const [agent, info] of counts) {
      if (info.count > bestCount) {
        bestAgent = agent;
        bestCount = info.count;
        bestIds = info.ids;
      }
    }
    return { subAgent: bestAgent, matchedSkills: bestIds };
  }
}

function defaultSubAgentForDomain(domain: Domain): string {
  switch (domain) {
    case "blockchain":
      return "solana_vulnerability_analyst";
    case "web":
      return "supply_chain_analyst";
    case "ai":
      return "report_synthesizer";
    case "reverse_engineering":
      return "secret_hygiene_scanner";
  }
}
