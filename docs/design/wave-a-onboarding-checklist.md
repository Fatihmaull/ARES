# Wave A Onboarding Checklist

**Status:** Operational checklist for P5 (Wave A — 12–15 skills).

**Related:** [wave-a-skill-manifest.md](./wave-a-skill-manifest.md), [agent-hierarchy-contracts-v1.md](./agent-hierarchy-contracts-v1.md), [billing-metering-spec-v1.md](./billing-metering-spec-v1.md).

---

## 1. Per-skill onboarding template

Each Wave A row gets one entry below. Fields:

- **Owner sub-agent** — where the skill is loaded at boot (per registry).
- **Adapter file** — `packages/engine/src/skills/adapters/<id>.ts`.
- **Tools needed** — must already exist in `assurance-tools/index.ts` or be added before onboarding.
- **Cost class** — drives policy gating.
- **Min tier** — `free` | `paid` | `premium`.
- **Test plan** — at minimum a smoke test invoking the skill end-to-end through the orchestrator with a fixed prompt.

### Wave A entries

| # | Skill | Owner sub-agent | Cost class | Min tier | Smoke prompt (test fixture) |
|---|-------|-----------------|------------|----------|------------------------------|
| 1 | `osec-solana-auditor-introduction` | `solana_vulnerability_analyst` | A | free | "Summarize the Solana auditor primer in 5 bullets." |
| 2 | `armaniferrante-x-status-solana-reference` | `solana_vulnerability_analyst` | A | free | "Cite Anchor-era PDA seed guidance from the reference." |
| 3 | `cmichel-smart-contract-auditor-guide` | `defi_security_auditor` | A | free | "List the audit playbook stages from cmichel guide." |
| 4 | `blockchain-intelligence-fundamentals` | `supply_chain_analyst` | A | free | "Explain mempool vs block-explorer intelligence in 3 lines." |
| 5 | `crypto-investigation-compliance` | `supply_chain_analyst` | A | free | "Outline FATF travel-rule basics in 4 bullets." |
| 6 | `solana-tracing-specialist` | `solana_vulnerability_analyst` | B | free | "Trace a sample tx hash and summarize hops." (uses `solanaRpcReadTool` mock) |
| 7 | `solana-defi-vulnerability-analyst-agent` | `solana_vulnerability_analyst` | B | free | "Identify oracle-dependency risks in a sample Anchor program." |
| 8 | `chainalysis-sanctions-screening` | `supply_chain_analyst` | B | free | "Describe a screening pipeline at high level." |
| 9 | `honeypot-detection-techniques` | `rug_pull_detector` | B | free | "List 5 honeypot patterns visible from on-chain data." |
| 10 | `address-clustering-attribution` | `solana_vulnerability_analyst` | B | free | "Outline 4 cluster heuristics for Solana addresses." |
| 11 | `sealevel-attacks-solana` | `solana_vulnerability_analyst` | B | free | "Name 5 sealevel attack categories." |
| 12 | `flash-loan-exploit-investigator-agent` | `defi_security_auditor` | C | paid | "Walk through a flash-loan post-mortem skeleton." |
| 13 | `defi-security-audit-agent` | `defi_security_auditor` | C | paid | "Run a high-level audit checklist for a sample DeFi protocol." |
| 14 | `rug-pull-pattern-detection-agent` | `rug_pull_detector` | D | premium | "Score a token launch from on-chain signals." |
| 15 | `solana-onchain-intelligence-resources` | `solana_vulnerability_analyst` | B | free | "List 6 high-signal Solana intel resources." |

---

## 2. Acceptance gates

A skill is marked `enabled: true` in the registry only when **all** below pass:

1. `SKILL.md` parses (frontmatter, description present, ≤ size cap).
2. Adapter file present and exports both metadata and a no-op invoker.
3. Owner sub-agent loads the skill in its `skills` array.
4. Policy engine returns `allowed: true` for the declared min tier with the declared cost class.
5. Smoke fixture passes against a mocked tool surface.
6. Telemetry event `kind="result"` emitted with `agent === ownerSubAgent` and `costClassHint === costClass`.

---

## 3. Out of scope for Wave A

- Wave B/C skills (deferred per blueprint §14).
- New tools beyond what `assurance-tools/index.ts` already exports.
- Cross-domain composite skills (handled later by `CapabilityGraph`).

---

## 4. Revision history

| Date | Change |
|------|--------|
| 2026-05-05 | Initial Wave A onboarding checklist |
