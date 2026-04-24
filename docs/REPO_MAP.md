# Repo map

Every top-level directory, in one place, with a one-line description and a
pointer to its own `README.md` when one exists.

> **If you're new here, read this file first, then `ARCHITECTURE.md`, then
> `packages/engine/README.md`.**

```
ASST/
├── apps/                        Deployable surfaces (CLI, web, MCP, chain intake)
│   ├── asst-cli/                @asst/cli — terminal client
│   ├── web/                     @asst/web — Next.js dashboard + public API
│   ├── mcp-server/              @asst/mcp-server — MCP stdio server for Cursor / Claude
│   └── chain-intake/            @asst/chain-intake — Helius → Postgres → manifest
│
├── packages/                    Reusable libraries (workspace:*)
│   └── engine/                  @ares/engine — multi-agent orchestrator + tools
│
├── deepagentsjs/                Vendored LangGraph engine + examples (pattern reference)
│   ├── libs/                    deepagents core, providers, graph backends
│   ├── examples/                Runnable demos incl. assurance-run manifest pipeline
│   └── …                        See deepagentsjs/README.md
│
├── docs/                        PRD, dashboard UX notes, narrative docs (EN + ID)
├── .agents/skills/              CANONICAL skills directory. Loaded by @ares/engine.
├── scripts/                     Ad-hoc automation (Colosseum Copilot scan, etc.)
├── analysis/                    Optional positioning / revenue-forecast notebooks
├── assurance/                   (gitignored) generated run manifests & SARIF output
├── .asst/                       (gitignored) local CLI state (sqlite, config)
├── .superstack/                 Internal planning notes (not product code)
├── .github/                     CI workflows
│
├── README.md                    You-are-here overview
├── REPO_MAP.md                  This file
├── ARCHITECTURE.md              System design (points to WHITEPAPER § 9)
├── CONTRIBUTING.md              Dev workflow, conventions, how to add things
├── WHITEPAPER.md / .en / .id    Product narrative (English + Bahasa Indonesia)
├── TOOLS.md / REFERENCES.md     Tool catalog + citations
├── COMPETITORS.md / PRD.md      Market + product spec
├── WALKTHROUGH.md               End-to-end demo script
├── .env.example                 Template for root env vars (copy to .env.local)
├── Launch_ASST.bat / .ps1       Windows launchers for the CLI
├── launch-asst.sh               POSIX launcher for the CLI
├── pnpm-workspace.yaml          pnpm workspace config (packages/* + apps/*)
└── package.json                 Root — runs `pnpm -r build|dev`
```

## Where does X live?

| Question                                                     | Answer                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| "Where is the orchestrator?"                                 | `packages/engine/src/orchestrator.ts`                    |
| "Where are the 6 sub-agents defined?"                        | `packages/engine/src/sub-agents.ts`                      |
| "Where do I add a new assurance tool?"                       | `packages/engine/src/assurance-tools/` (+ update index)  |
| "Where are the read-only vs mutating tools?"                 | `packages/engine/src/tools/readonly.ts` / `mutating.ts`  |
| "Where is the model factory (pick Gemini/OpenRouter/Ollama)?"| `packages/engine/src/config/model-factory.ts`            |
| "Where do skills get loaded from?"                           | `packages/engine/src/skills/loader.ts` → `.agents/skills`|
| "Where is the SQLite schema?"                                | `packages/engine/src/persistence/sqlite.ts`              |
| "Where is the web API for /api/chat?"                        | `apps/web/app/api/chat/route.ts`                         |
| "Where does the web enforce read-only?"                      | `apps/web/lib/engine-factory.ts`                         |
| "Where are the MCP tool bindings?"                           | `apps/mcp-server/src/server.ts`                          |
| "Where is the CLI command router?"                           | `apps/asst-cli/src/asst.ts`                              |
| "Where does Helius push webhook data?"                       | `apps/chain-intake/src/server.ts`                        |
| "Where is the assurance manifest writer?"                    | `deepagentsjs/examples/assurance-run/write-run-manifest.ts` |
| "Where are skills authored?"                                 | `.agents/skills/<skill-name>/SKILL.md`                   |

## What is ignored from git?

See `.gitignore`. Notable:

- `dist/`, `*.tsbuildinfo`, `apps/web/.next/` — build output
- `.asst/`, `var/` — local runtime state
- `assurance/` — per-run manifests (uploaded as CI artifacts instead)
- `.env`, `.env.local`, `.env.*` — local credentials
- `*.pdf` except `docs/**/*.pdf`
