// ─── Public API of @ares/engine ─────────────────────────────────
// See packages/engine/README.md for the layout.

// Core orchestrator + sub-agent registry
export { Orchestrator } from "./orchestrator.js";
export {
  createAllSubAgents,
  SubAgent,
  SUB_AGENT_CONFIGS,
  type SubAgentConfig,
} from "./sub-agents.js";

export {
  SUB_AGENT_PUBLIC_LIST,
  type SubAgentPublicEntry,
} from "./sub-agent-public-manifest.js";

// Persistence (SQLite-backed; migrates legacy lowdb JSON on first run)
export { ASSTPersistenceSQLite } from "./persistence/sqlite.js";

// Skill discovery + retrieval
export { listInstalledSkills, loadSkills } from "./skills/loader.js";
export {
  buildSkillCatalog,
  rankSkillsForQuery,
  loadSkillsForTask,
  renderCatalogSummary,
  type SkillCatalog,
  type SkillCatalogEntry,
  type RankedSkill,
  type LoadSkillsForTaskOptions,
  type LoadSkillsForTaskResult,
} from "./skills/retrieval.js";
export { parseSkillMarkdown, type SkillFrontmatter } from "./skills/frontmatter.js";
export { buildIndex, rank, tokenize, type TfIdfIndex } from "./skills/tfidf.js";

// Model factory — swap Gemini / OpenRouter / OpenAI-compatible / Ollama
export {
  createModel,
  parseModelId,
  DEFAULT_ORCHESTRATOR_MODEL,
  type ModelId,
  type ModelProvider,
} from "./config/model-factory.js";

// Agent tools
export * from "./tools/index.js";
export * from "./assurance-tools/index.js";

// Structured findings (Zod schema + helpers + SARIF bridge)
export * from "./findings/index.js";

// Sandbox execution surface (host / docker / deepagents-adapter)
export * from "./sandbox/index.js";
