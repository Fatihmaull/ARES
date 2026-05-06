# ASST — Architecture

**Version 0.3** · canonical system design for the multi-agent stack.

> Short version: one engine, many surfaces. Read
> [`packages/engine/README.md`](./packages/engine/README.md) for the public
> API and [`docs/REPO_MAP.md`](./docs/REPO_MAP.md) for full directory
> navigation.

## 1. System diagram

```
                               ┌───────────────────────────────────────┐
                               │           @ares/engine                │
                               │                                       │
  repoRoot  ─────────────────▶ │  Orchestrator                         │
  model id  ─────────────────▶ │    ├── createModel()  (model-factory) │
  skills    ◀──── loader  ──── │    ├── 6 sub-agents (SubAgent class)  │
                               │    │    ├── Solana Vulnerability       │
                               │    │    ├── DeFi Security              │
                               │    │    ├── Rug Pull Detector          │
                               │    │    ├── Secret Hygiene             │
                               │    │    ├── Supply Chain               │
                               │    │    └── Report Synthesizer         │
                               │    ├── tools/readonly.ts               │
                               │    ├── tools/mutating.ts (HITL-gated)  │
                               │    │     └── SandboxBackend ───────────┼──▶ host / docker
                               │    │         (sandbox/*)               │     / deepagents
                               │    └── assurance-tools/*               │     (Daytona, Modal,
                               │         (Semgrep, SARIF merge,         │      node-vfs, …)
                               │          Solana RPC, program scanners) │
                               │                                       │
                               │  ASSTPersistenceSQLite  ─── .asst/    │
                               └───────────────────────────────────────┘
                                                ▲
           ┌───────────────────────┬────────────┴────────────┬──────────────────────┐
           │                       │                         │                      │
    ┌────────────┐          ┌────────────┐           ┌────────────┐          ┌────────────┐
    │ @asst/cli  │          │ @asst/web  │           │@asst/mcp-  │          │@asst/chain-│
    │            │          │            │           │ server     │          │ intake     │
    │ Interactive│          │ Next.js    │           │ stdio MCP  │          │ Helius → PG│
    │ TUI + HITL │          │ dashboard  │           │ for Cursor │          │ → manifest │
    │ prompts    │          │ + public   │           │ / Claude   │          │            │
    └────────────┘          │ /api/*     │           └────────────┘          └────────────┘
                            │ (readonly  │
                            │ by default)│
                            └────────────┘
```

## 2. Boundaries

- **Engine** (`@ares/engine`) holds 100% of agent/tool logic. Apps are thin.
- **Tools** are split:
  - `tools/readonly.ts` — safe everywhere (web, MCP, CLI).
  - `tools/mutating.ts` — produced by a factory that takes a `permissionFn`
    callback. No mutation happens without a yes from the host.
  - `assurance-tools/*` — deterministic program/supply-chain analyzers;
    side-effect-bounded (some call out to `semgrep`, Solana RPC, git).
- **Model** is never hardcoded. `createModel("<provider>:<model>")` is the
  single entry point; supports Gemini, OpenRouter, OpenAI-compatible,
  Ollama, and `local:` LM-Studio-style endpoints.

## 3. Data flow — deterministic full scan

```
 user ──▶ CLI/web/MCP ──▶ Orchestrator.runFullScan(repoRoot)
                                    │
                                    ├─ runs each sub-agent in order
                                    │    (each agent uses its skill-filtered
                                    │     system prompt + readonly tools)
                                    │
                                    ├─ writes transcripts to .asst/asst.db
                                    │
                                    └─▶ returns FullScanResult
                                          └─ persisted SARIF + JSON under
                                             <repoRoot>/assurance/ (if present)
```

## 4. Data flow — interactive chat

```
 user prompt ──▶ Orchestrator.chat(prompt)
                       │
                       ├─ loads recent history from sqlite
                       ├─ calls LLM with system prompt + sub-agent registry
                       ├─ LLM emits tool call → `delegate_to_sub_agent`
                       ├─ sub-agent runs (readonly tools only by default)
                       └─ returns streamed messages; persisted
```

## 5. Security model

- **Public surface** = web, MCP. Both get read-only tools only.
- **Trusted surface** = CLI (local dev). Mutating tools gated by
  `globalThis.ARES_ASK_PERMISSION` (interactive confirm).
- **ASST_ALLOW_WRITE=0** forces refusal regardless of the permission hook.
- **ASST_WEB_ALLOW_WRITE=1** is the explicit opt-in for trusted private
  deployments (e.g. a CI runner for your own repo).

### 5.1 Sandbox backends

Mutating tools don't run commands directly — they go through a
`SandboxBackend` produced by `createSandbox()`. The default backend
(`host`) preserves the legacy "execa on the host" behavior; production /
multi-tenant deployments should switch to `docker` (throwaway container
per command, `--network none` by default) or adapt a deepagents provider
(Daytona, Modal, Deno, node-vfs, QuickJS) with `adaptDeepAgentsSandbox`.

```ts
import { createSandbox, createMutatingTools } from "@ares/engine";

const sandbox = await createSandbox();            // honors ASST_SANDBOX_BACKEND
const tools   = createMutatingTools({ sandbox, askPermission });
```

See [`packages/engine/src/sandbox/README.md`](./packages/engine/src/sandbox/README.md)
for the full backend matrix and env knobs
(`ASST_SANDBOX_BACKEND`, `ASST_SANDBOX_DOCKER_*`, `ASST_CMD_*`).

## 6. Persistence

SQLite file at `<repoRoot>/.asst/asst.db` (WAL mode). Tables:

| Table                  | Rows                                                      |
| ---------------------- | --------------------------------------------------------- |
| `chat_messages`        | Chat history per session (role, content, ts, meta)        |
| `scan_results`         | Full scan output + metadata                               |
| `scan_targets`         | Repos/paths being tracked                                 |
| `agent_runs`           | Individual sub-agent invocations + token counts           |
| `findings`             | (structured findings — pending B1 in todo)                |

Legacy lowdb JSON is migrated on first run by `ASSTPersistenceSQLite`.

## 7. Skills

- Canonical location: `.agents/skills/<skill-name>/SKILL.md`.
- Loaded by `packages/engine/src/skills/loader.ts` on agent boot.
- Each sub-agent filters skills relevant to its role.
- **Planned** (B2): TF-IDF retrieval to keep context budgets small.

## 8. Extensibility

- **New assurance tool** → drop in `packages/engine/src/assurance-tools/`,
  export from `assurance-tools/index.ts`. Available everywhere immediately
  (CLI, web API, MCP by registering in `apps/mcp-server/src/server.ts`).
- **New sub-agent** → add to `SUB_AGENT_CONFIGS` in `sub-agents.ts`.
- **New surface** → depend on `@ares/engine`, use `createPublicOrchestrator`
  if the surface is reachable by untrusted users.

## 9. Related documents

- **Repository map (every top-level dir):** [`docs/REPO_MAP.md`](./docs/REPO_MAP.md)
- **Product narrative (canonical EN + ID):** [`docs/WHITEPAPER.en.md`](./docs/WHITEPAPER.en.md) ·
  [`docs/WHITEPAPER.id.md`](./docs/WHITEPAPER.id.md) · hub
  [`docs/WHITEPAPER.md`](./docs/WHITEPAPER.md)
- **Product + quick links:** [`README.md`](./README.md)
- **Requirements:** [`docs/PRD.md`](./docs/PRD.md)
- **Walkthrough / demo script:** [`docs/walkthrough.md`](./docs/walkthrough.md)
- **Tool catalog (hub + EN/ID stubs):** [`docs/TOOLS.md`](./docs/TOOLS.md)
- **References (hub + citations):** [`docs/REFERENCES.md`](./docs/REFERENCES.md)
- **Dashboard UX + digest payload:** [`docs/DASHBOARD-UX.en.md`](./docs/DASHBOARD-UX.en.md) ·
  [`docs/DASHBOARD-UX.id.md`](./docs/DASHBOARD-UX.id.md)
- **Public web (auth / billing design):** [`docs/design/public-web-auth-billing.md`](./docs/design/public-web-auth-billing.md)
- **Tools / code map (Deep Agents ↔ WHITEPAPER §10):** [`deepagentsjs/docs/TOOLS-MAP.md`](./deepagentsjs/docs/TOOLS-MAP.md)

---

*Internal documentation. Not a security audit or legal advice.*
