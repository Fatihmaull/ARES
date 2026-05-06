# Runbooks

Operational playbooks for the production-ready ARES platform. Each document
is self-contained and references the production-readiness phase plan and the
blueprint where relevant.

| Topic | Document |
|-------|----------|
| First-time deployment + topology | [deployment.md](./deployment.md) |
| Paid-pilot smoke + reconciliation | [paid-pilot.md](./paid-pilot.md) |
| PayAI webhook outage | [payai-webhook-outage.md](./payai-webhook-outage.md) |
| Worker drain / restart | [worker-drain.md](./worker-drain.md) |
| Refund batches | [refund-batches.md](./refund-batches.md) |
| Neon / DB outage | [neon-failover.md](./neon-failover.md) |

For the underlying decisions and acceptance criteria, see:

- [docs/design/ares-web-native-development-blueprint-consolidated.md](../design/ares-web-native-development-blueprint-consolidated.md)
- [docs/design/billing-metering-spec-v1.md](../design/billing-metering-spec-v1.md)
- [docs/design/agent-hierarchy-contracts-v1.md](../design/agent-hierarchy-contracts-v1.md)
- [docs/design/wave-a-onboarding-checklist.md](../design/wave-a-onboarding-checklist.md)
