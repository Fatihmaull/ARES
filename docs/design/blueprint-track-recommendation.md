# Blueprint §19 track recommendation

**Status:** engineering guidance (not a locked decision).  
**Related:** [ares-web-native-development-blueprint-consolidated.md](./ares-web-native-development-blueprint-consolidated.md) §19.

## Tracks

| Track | Scope | Dependency |
|-------|--------|------------|
| **Wave A** | Wire [wave-a-skill-manifest.md](./wave-a-skill-manifest.md) into `@ares/engine` policy + metering | Current web billing / ledger |
| **K8s workers** | Queue + async scans + worker runtime | Orchestration contract, infra |
| **Hierarchical orchestrator** | Supervisors / coordinators / sub-agents as runtime graph | Engine refactor; overlaps Wave A |

## Recommended order

1. **Wave A first** — Delivers user-visible capability (skills + cost classes) on the existing synchronous `/api/chat` and `/api/scan` paths without requiring Kubernetes. Aligns with credits already debited in `apps/web`.

2. **K8s queue + workers second** — Move heavy scans off the web process once skill policies and metering are stable; reduces blast radius and unlocks backlog metrics.

3. **Full hierarchical orchestrator third** — Largest refactor; easier to justify once Wave A usage and worker queues justify the complexity.

## When to reorder

- If **latency or reliability** of long scans blocks production before skill breadth, prioritize **K8s workers** earlier with a **minimal** worker contract.
- If **multi-agent coordination** is the primary risk, pull **hierarchical orchestrator** earlier but scope to **one** supervisor path only.

---

*Last updated: 2026-04-27*
