# WHITEPAPER §10 ↔ `deepagentsjs` code map

Normative catalog: [WHITEPAPER.en.md § 10](../../WHITEPAPER.en.md#10-integration-tools-and-execution-surface) (repo root); hub: [TOOLS.md](../../TOOLS.md).

| TOOLS section | Concept | Implementation | Policy |
|---------------|---------|----------------|--------|
| §A | Core agent tools (`task`, filesystem, `execute`) | [`libs/deepagents`](../libs/deepagents/) — `createDeepAgent`, middleware | `execute` only via sandbox backends in production |
| §B | Solana RPC read-only | [`examples/assurance-tools/solana-rpc-read.ts`](../examples/assurance-tools/solana-rpc-read.ts) — `fetch` to RPC URL | No signing keys; URL from env |
| §C | Static / build (`semgrep`, `cargo audit`, `anchor build`) | Semgrep lane: [`examples/assurance-run/src/run-semgrep.ts`](../examples/assurance-run/src/run-semgrep.ts), merge: [`merge-sarif.ts`](../examples/assurance-run/src/merge-sarif.ts); CLI wrappers in [`assurance-tools`](../examples/assurance-tools/) | Risky CLI via sandbox `execute` in real deployments |
| §D | Repo / diff / lockfile | [`examples/assurance-tools/git-diff-summary.ts`](../examples/assurance-tools/git-diff-summary.ts) | Read-only `git` via `execute` with scoped cwd |
| §E | Manifest + merged findings | [`examples/assurance-run/write-run-manifest.ts`](../examples/assurance-run/write-run-manifest.ts), [`build-manifest.ts`](../examples/assurance-run/src/build-manifest.ts) | Writes under `assurance/` |
| §F | MCP / Ghidra / LLM-SAST | **MCP (stdio):** [`examples/asst-mcp-server`](../examples/asst-mcp-server/README.md) exposes Semgrep, merge SARIF, git summary, Solana RPC read, manifest writer as MCP tools · Ghidra / LLM-SAST still optional | MCP server ships in-repo; hosted wiring is client config |

Preset orchestration: use **`@ares/engine` `Orchestrator`** (sub-agents + assurance tools). Runnable wrapper: [`examples/solana-elite-auditor/src/run-elite-orchestrator.ts`](../examples/solana-elite-auditor/src/run-elite-orchestrator.ts). Optional Deep Agents shell: [`create-elite-deep-agent.ts`](../examples/solana-elite-auditor/src/create-elite-deep-agent.ts). OpenRouter chat helper: [`packages/engine/src/assurance-tools/assurance-llm.ts`](../../../packages/engine/src/assurance-tools/assurance-llm.ts) (`createAssuranceRunChatModel`, **`OPENROUTER_API_KEY`** when used).

### Subagents → tools / modules (Assurance Run Solana)

| Role | Subagent / entry | Tools & code paths |
|------|------------------|---------------------|
| **Orchestrator** | `@ares/engine` `Orchestrator` + sub-agents | Tools live under [`packages/engine/src/assurance-tools/`](../../../packages/engine/src/assurance-tools/) (e.g. `solana-rpc-read.ts`, `git-diff-summary.ts`, manifest + merge + PDF). |
| **Static / policy lane** | `static-policy` | Same tool surface as orchestrator; prompt focuses on SAST/SARIF/manifests — implementation lanes: [`run-semgrep.ts`](../examples/assurance-run/src/run-semgrep.ts), [`merge-sarif.ts`](../examples/assurance-run/src/merge-sarif.ts) (CI / manifest writer call these outside the agent graph). |
| **Build / verify lane** | `build-verify` | Prompt-only subagent for Rust/Anchor reasoning; isolated build **evidence** matches CI pattern in [`.github/workflows/assurance-run-pr.yml`](../../.github/workflows/assurance-run-pr.yml) (isolated cwd); real `execute` belongs in sandbox backends (§A). |

LLM wiring: [`assurance-llm.ts`](../examples/assurance-tools/assurance-llm.ts) (`createAssuranceRunChatModel`, `tryCreateAssuranceOpenRouterModel` for optional smoke). Smoke: [`examples/assurance-run/openrouter-smoke.ts`](../examples/assurance-run/openrouter-smoke.ts).

**Tracing (optional):** set LangSmith / LangChain tracing env vars (see `deepagentsjs/.env.example`), then run `openrouter-smoke` or invoke the agent once and inspect runs in the [LangSmith](https://smith.langchain.com) UI.
