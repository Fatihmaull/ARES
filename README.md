# ASST — ARES Solana Security Tool

**ARES Solana Security Tool** (**ASST**) — a multi-agent security stack for
teams shipping Solana (and related) software. Deployed as **Assurance Run**:
orchestrated checks + commit-bound evidence, not a one-shot "audit".

**Canonical source:** [github.com/ares-system/ares-system](https://github.com/ares-system/ares-system)

> **New here?** Read [`docs/REPO_MAP.md`](./docs/REPO_MAP.md), then
> [`ARCHITECTURE.md`](./ARCHITECTURE.md), then
> [`packages/engine/README.md`](./packages/engine/README.md) (engine API) and
> [`apps/web/README.md`](./apps/web/README.md) (public web + dashboard).

## What ASST does

Given a Solana repository, ASST can:

1. Run a **deterministic 6-agent full scan** — Solana vulnerabilities,
   DeFi security, rug-pull risk, secret hygiene, supply chain, report synthesis.
2. Chat interactively — the orchestrator delegates to the right sub-agent.
3. Emit **assurance manifests**: signed-ish JSON bundles of tool output
   + SARIF + git metadata, reproducible across runs.
4. Expose the same tools to Cursor / Claude Desktop via **MCP**.
5. Surface results in a **Next.js web app** — marketing pages plus a
   **security dashboard** (`/dashboard`) backed by the same engine.

## Architecture at a glance

```
           ┌────────────────────────────────────────────────┐
           │                 @ares/engine                   │  ← single source of
           │  orchestrator · 6 sub-agents · assurance tools │    truth for agent
           │  model factory · skills loader · sqlite store  │    logic
           └────────────────────────────────────────────────┘
                                   ▲
               ┌───────────────────┼───────────────────┬────────────────────┐
               │                   │                   │                    │
         ┌──────────┐       ┌─────────────┐      ┌────────────┐      ┌────────────┐
         │ @asst/cli│       │  @asst/web  │      │@asst/mcp-  │      │@asst/chain-│
         │ (terminal)│      │  (Next.js)  │      │ server     │      │ intake     │
         └──────────┘       └─────────────┘      └────────────┘      └────────────┘
              HITL              public API           stdio MCP          Helius → PG
            prompts          (read-only by          (read-only
                              default)               tools only)
```

- **All agent logic** lives in `packages/engine/` (`@ares/engine`).
- **Every surface** (CLI, web, MCP) imports from `@ares/engine`. No duplication.
- **Public surfaces** (web) default to read-only; mutating tools require
  explicit opt-in + per-call HITL confirmation.

## Layout

| Path | What |
| ---- | ---- |
| `packages/engine/` | `@ares/engine` — orchestrator, sub-agents, tools, persistence, skills loader. See [`packages/engine/README.md`](./packages/engine/README.md). |
| `apps/asst-cli/` | `asst` terminal client. See [`apps/asst-cli/README.md`](./apps/asst-cli/README.md). |
| `apps/web/` | Next.js marketing site, dashboard, `/api/*`. See [`apps/web/README.md`](./apps/web/README.md). |
| `apps/mcp-server/` | MCP stdio server for Cursor / Claude. See [`apps/mcp-server/README.md`](./apps/mcp-server/README.md). |
| `apps/chain-intake/` | Helius webhook receiver + backfill. See [`apps/chain-intake/README.md`](./apps/chain-intake/README.md). |
| `deepagentsjs/` | Vendored LangGraph stack, examples, eval harnesses (e.g. `evals/ares-security/`, `libs/dataset/benchmark-tier-a/`). |
| `.agents/skills/` | Canonical skills directory loaded by the engine. |
| `docs/` | PRD, walkthrough, **repo map** ([`docs/REPO_MAP.md`](./docs/REPO_MAP.md)), whitepaper, tool catalog, references, dashboard UX, security checklists. |

## Web UI (public + dashboard)

- **Stack:** Next.js 15, Tailwind, shared layout across landing and `/dashboard/*`.
- **Theme:** global **dark / light** toggle; preference is stored in `localStorage` (`ares-theme`) and applied before first paint to avoid flash.
- **Product / billing:** there is no live in-repo payment processor. Planned auth, tiers, and billing are described in [`docs/design/public-web-auth-billing.md`](./docs/design/public-web-auth-billing.md).

## Quick start

```bash
# From repo root
pnpm install
pnpm -r build

# Typecheck all packages that define a `typecheck` script
pnpm typecheck

# Interactive CLI (Windows)
./Launch_ASST.bat

# Interactive CLI (macOS / Linux)
./launch-asst.sh

# Web app
pnpm --filter @asst/web dev    # http://localhost:3000

# MCP server (wire into Cursor / Claude Desktop)
pnpm --filter @asst/mcp-server start
```

Copy `.env.example` to `.env.local` and fill in the keys you need. Only the
provider matching your chosen orchestrator model is required — Ollama /
local-model users don't need any cloud keys.

## Model choice (SDK/CLI + web)

The orchestrator model is configurable, never hardcoded. Supported:

- `google:gemini-2.5-flash` — default, needs `GOOGLE_API_KEY`
- `openrouter:<model>` — needs `OPENROUTER_API_KEY`
- `openai:<model>` — OpenAI or any OpenAI-compatible endpoint
- `ollama:<model>` — local, no key required
- `local:<model>@<baseUrl>` — LM Studio etc.

Set via `--model`, `.asst/config.json`, or `$ASST_ORCHESTRATOR_MODEL`.
Full list in [`packages/engine/README.md`](./packages/engine/README.md).

## Security model

The public surface rule is: **read-only by default, mutations require HITL**.

- Mutating tools (`write_file`, `run_terminal_cmd`) are produced by a factory
  that calls a permission callback before every write/exec.
- The CLI installs an interactive prompt. The web uses a default-deny hook,
  disabled entirely unless `ASST_WEB_ALLOW_WRITE=1` is set on the server.
- The MCP server doesn't register mutating tools at all.

Details: [`packages/engine/README.md` § Security model](./packages/engine/README.md).

## Documentation index

| Document | Purpose |
| -------- | ------- |
| [`docs/REPO_MAP.md`](./docs/REPO_MAP.md) | Every top-level directory, one place |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, surfaces vs engine |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Dev setup, conventions, how to add things |
| [`docs/WHITEPAPER.md`](./docs/WHITEPAPER.md) | Hub: EN / ID product narrative (canonical sections in **§9–§11**) |
| [`docs/TOOLS.md`](./docs/TOOLS.md) | Tool catalog hub + language stubs |
| [`docs/REFERENCES.md`](./docs/REFERENCES.md) | Citations and standards references |
| [`docs/PRD.md`](./docs/PRD.md) | Product requirements |
| [`docs/walkthrough.md`](./docs/walkthrough.md) | Demo / walkthrough script |
| [`docs/DASHBOARD-UX.en.md`](./docs/DASHBOARD-UX.en.md) | Dashboard UX spec |
| [`docs/design/public-web-auth-billing.md`](./docs/design/public-web-auth-billing.md) | Public web, auth, billing (design) |
| [`deepagentsjs/docs/TOOLS-MAP.md`](./deepagentsjs/docs/TOOLS-MAP.md) | Deep Agents code ↔ product tool mapping |
| [`deepagentsjs/docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md`](./deepagentsjs/docs/AI-SECURITY-BENCHMARK-FRAMEWORK-ID.md) | AI security benchmark framework (ID) |

## License

See [`LICENSE`](./LICENSE).

---

*Assurance Run is a pattern you implement and extend; it is not a substitute
for professional audits or formal verification when your threat model
requires them.*
