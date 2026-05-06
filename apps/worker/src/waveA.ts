import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { WAVE_A_SKILLS } from "@ares/engine";

export interface WaveAValidationResult {
  ok: boolean;
  missing: string[];
  invalidFrontmatter: string[];
  ownerSubAgentMissing: string[];
}

/**
 * Boot-time check that every enabled Wave A skill has a SKILL.md file under
 * `.agents/skills/<id>/SKILL.md`. Logs warnings; does not abort startup so
 * that operators can ship even if a skill repo path drifts.
 */
export function validateWaveASkills(repoRoot: string): WaveAValidationResult {
  const result: WaveAValidationResult = {
    ok: true,
    missing: [],
    invalidFrontmatter: [],
    ownerSubAgentMissing: [],
  };

  for (const skill of WAVE_A_SKILLS) {
    if (!skill.enabled) continue;
    const path = resolve(repoRoot, ".agents", "skills", skill.id, "SKILL.md");
    if (!existsSync(path)) {
      result.missing.push(skill.id);
      result.ok = false;
      continue;
    }
    const text = safeRead(path);
    if (!text || !text.trim()) {
      result.invalidFrontmatter.push(skill.id);
      result.ok = false;
    }
  }

  if (!result.ok) {
    console.warn("[ares-worker/waveA] validation issues:", result);
  } else {
    console.log(`[ares-worker/waveA] validated ${WAVE_A_SKILLS.length} skills`);
  }
  return result;
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
