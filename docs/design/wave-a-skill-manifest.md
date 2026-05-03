# Wave A Skill Manifest (12–15)

**Status:** Planning baseline for first onboarding wave after platform metering/policy exists.

**Related:** [ares-web-native-development-blueprint-consolidated.md](./ares-web-native-development-blueprint-consolidated.md) §14–§15.

Class map: **A** Light, **B** Standard, **C** Heavy, **D** Premium (blueprint §8).

| # | Skill dir (`.agents/skills/`) | Domain | Cost class | Policy note |
|---|------------------------------|--------|------------|-------------|
| 1 | `osec-solana-auditor-introduction` | Blockchain | A | Baseline Solana audit literacy |
| 2 | `armaniferrante-x-status-solana-reference` | Blockchain | A | Reference / Anchor-era patterns |
| 3 | `cmichel-smart-contract-auditor-guide` | Blockchain | A | General auditor playbook |
| 4 | `blockchain-intelligence-fundamentals` | Web / Intel | A | OSINT-style context |
| 5 | `crypto-investigation-compliance` | Compliance | A | Regulatory framing |
| 6 | `solana-tracing-specialist` | Blockchain | B | Flow tracing |
| 7 | `solana-defi-vulnerability-analyst-agent` | DeFi | B | Protocol-specific issues |
| 8 | `chainalysis-sanctions-screening` | Compliance | B | Screening workflows |
| 9 | `honeypot-detection-techniques` | Web / Token | B | Token/UI deception |
|10 | `address-clustering-attribution` | Intel | B | Cluster reasoning |
|11 | `sealevel-attacks-solana` | Blockchain | B | Attack taxonomy |
|12 | `flash-loan-exploit-investigator-agent` | DeFi | C | Heavy reasoning chains |
|13 | `defi-security-audit-agent` | DeFi | C | Broad DeFi audit surface |
|14 | `rug-pull-pattern-detection-agent` | DeFi | D | Narrative + multi-signal synthesis |
|15 | `solana-onchain-intelligence-resources` | Blockchain | B | Resource-heavy retrieval |

**Adapter notes:** Each row maps to one canonical `SKILL.md` loaded by `@ares/engine` skill loader; Wave A wiring adds **policy hooks** (tier allow/deny, cost class → debit multiplier when `pricing_catalog` extends tool metering).

---

## Revision history

| Date | Change |
|------|--------|
| 2026-04-27 | Initial Wave A list |
