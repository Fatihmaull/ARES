import { apiSuccess, getRequestId } from "@/lib/api";
import { readWalletSession } from "@/lib/auth/read-session";
import { getWalletTier } from "@/lib/billing/tier";
import { getPool } from "@/lib/db/pool";
import {
  DefaultPolicyEngine,
  StaticSkillRegistry,
  WAVE_A_SKILLS,
} from "@ares/engine";

export const runtime = "nodejs";

/**
 * Exposes the Wave A skill registry. UI uses this to show which skills
 * are available to the calling wallet given its tier, and which are paywalled.
 */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  const session = await readWalletSession(req);
  const pool = getPool();

  let tier: "anon" | "free" | "paid" | "premium" = "anon";
  if (session && pool) {
    const info = await getWalletTier(pool, session.sub);
    tier = info.tier;
  } else if (session) {
    tier = "free";
  }

  const registry = new StaticSkillRegistry(WAVE_A_SKILLS);
  const policy = new DefaultPolicyEngine({ registry });

  const skills = registry.list().map((s) => {
    const decision = policy.checkSkill({ tier, skillId: s.id });
    return {
      id: s.id,
      domain: s.domain,
      costClass: s.costClass,
      ownerSubAgent: s.ownerSubAgent,
      enabled: s.enabled,
      minTier: s.minTier ?? "free",
      allowedForCaller: decision.allowed,
      reason: decision.allowed ? null : decision.reason ?? null,
    };
  });

  return apiSuccess(requestId, {
    tier,
    skills,
    counts: {
      total: skills.length,
      allowed: skills.filter((s) => s.allowedForCaller).length,
      paywalled: skills.filter((s) => !s.allowedForCaller).length,
    },
  });
}
