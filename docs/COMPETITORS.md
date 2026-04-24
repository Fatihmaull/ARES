# Competitive landscape (internal)

**Product:** **ARES Solana Security Tool** (**ASST**) — Assurance Run workspace.

**Last scan:** `bash scripts/copilot-competitor-scan.sh` (local; not CI). Needs `COLOSSEUM_COPILOT_PAT` via export or repo `.env`. **As of API snapshot:** 2026-04-12 (queries below, `limit` 15 each).

**Colosseum Copilot** is a research API for Solana/crypto startup and competitive discovery (builder projects, archives, hackathon analytics, Grid + web in agent workflows). Product overview: [Colosseum Copilot — introduction](https://docs.colosseum.com/copilot/introduction). Docs index: [docs.colosseum.com/llms.txt](https://docs.colosseum.com/llms.txt).

For AI-assistant behavior (evidence floors, conversational vs deep-dive, accelerator/winner checks), use the **`colosseum-copilot`** skill in Claude Code: `npx skills add ColosseumOrg/colosseum-copilot`.

## Auth and pre-flight (required)

1. Set **`COLOSSEUM_COPILOT_PAT`** (from [arena.colosseum.org/copilot](https://arena.colosseum.org/copilot)) and **`COLOSSEUM_COPILOT_API_BASE`** (default `https://copilot.colosseum.com/api/v1`). Treat the PAT like a password; do not commit it or paste it into public logs.
2. **Before other calls**, verify with **`GET /status`**. Expect JSON including `"authenticated": true` (and `expiresAt`, `scope`). On **401**, fix PAT or base URL — do not hammer search endpoints.
3. Optional: after the first response, check header **`X-Copilot-Skill-Version`** against the skill’s documented version; if newer, refresh the skill per its install command.

## How to populate (this repo)

1. Put credentials in **`.env` at the repo root** or **`deepagentsjs/.env`** (gitignored), or `export` in the shell (export wins over `.env` for PAT):
   ```bash
   COLOSSEUM_COPILOT_API_BASE=https://copilot.colosseum.com/api/v1
   COLOSSEUM_COPILOT_PAT=your-token-here
   ```
2. Run the scripted scan (calls `/status`, then `search/projects` and `search/archives`):
   ```bash
   bash scripts/copilot-competitor-scan.sh 2>&1 | tee scripts/copilot-scan-output.txt
   ```
3. Paste **project slugs**, hackathon names/dates (`hackathon.startDate` from API when present), and short notes into the table below.

### If you see `UNAUTHORIZED` / “Invalid or expired access token”

The API returns `{"code":"UNAUTHORIZED",...}` when the bearer token is wrong or no longer valid. **Fix:** create a new PAT at [arena.colosseum.org/copilot](https://arena.colosseum.org/copilot), update `.env`, and confirm `COLOSSEUM_COPILOT_API_BASE` is exactly `https://copilot.colosseum.com/api/v1` (no typo, no trailing issues). PATs are long-lived but **rotate ~every 90 days** per Colosseum docs. Avoid stray spaces or line breaks in the token line. The repo script exits immediately after a failed `/status` so search endpoints are not spammed.

## API quick reference (competitor / landscape work)

| Endpoint | Method | Use |
|----------|--------|-----|
| `/status` | GET | Auth check — call first |
| `/search/projects` | POST | Builder projects (filters e.g. `acceleratorOnly`, `winnersOnly`) |
| `/search/archives` | POST | Archive citations for framing |
| `/projects/by-slug/:slug` | GET | Full project detail |
| `/filters` | GET | Hackathon list + `startDate` (chronology) |
| `/analyze`, `/compare` | POST | Hackathon analysis |
| `/feedback` | POST | Quality / errors (rate-limited) |

Grid ecosystem data: [The Grid](https://thegrid.id/) — see [docs.thegrid.id](https://docs.thegrid.id).

## Copilot — project search (2026-04-12)

Script queries: `Solana security audit CI` (broad), `static analysis SARIF`, `program security` with `acceleratorOnly`, same with `winnersOnly`. Rows below dedupe slugs and emphasize **audit / CI / static analysis / fuzz / monitoring / wallet security** overlap with ASST; other hits (payments, games, DeFi) are omitted here but appear in raw JSON when you run the script.

| Slug (from API) | Hackathon / `startDate` | Notes |
|-----------------|-------------------------|-------|
| `bulwark` | Cypherpunk · 2025-09-25 | Autonomous security ops; static analysis, audit scoping, risk detection (`static analysis / SARIF` slice). |
| `smart-contract-security-audit` | Breakout · 2025-04-14 | AI-driven multi-chain contract auditing (broad + SARIF slices). |
| `solanaizer` | Renaissance · 2024-03-04 | GitHub-integrated AI audit; CI/static-analysis angle; HM Infrastructure. |
| `excalead` | Cypherpunk · 2025-09-25 | AI + formal verification, subscription audits; HM Infrastructure. |
| `audit.ai` | Radar · 2024-09-02 | AI smart-contract auditing platform. |
| `poirot` | Renaissance · 2024-03-04 | Competitive audit marketplace / researcher–protocol matching; HM. |
| `leetsol` | Radar · 2024-09-02 | Hybrid automated + manual Solana audits. |
| `gecko-fuzz` | Renaissance · 2024-03-04 | Crowdsourced fuzzing infra on Solana (fuzzing overlap). |
| `vulnera:-a-decentralized-bug-bounty-platform` | Cypherpunk · 2025-09-25 | On-chain bug bounty marketplace. |
| `solana-buildpack` | Renaissance · 2024-03-04 | Cloud Native Buildpack for Solana toolchain — CI/build reproducibility adjacent. |
| `insureos` | Renaissance · 2024-03-04 | DeFi insurance with recurring codebase coverage (risk/audit-adjacent). |
| `idl-space` | Breakout · 2025-04-14 | Postman-like IDL explorer/debug; Public Goods Award. |
| `txtx` | Radar · 2024-09-02 | Reproducible runbooks for smart-contract infra; 1st Infrastructure. |
| `tokamai` | Radar · 2024-09-02 | On-chain program monitoring/alerts; 2nd Infrastructure; accelerator C2. |
| `conyr` | Breakout · 2025-04-14 | Real-time analytics; security-monitoring framing; 5th Infrastructure. |
| `mercantill` | Cypherpunk · 2025-09-25 | Enterprise agent banking with **audit trails** for AI spend; 4th Stablecoins. |
| `detectify` | Cypherpunk · 2025-09-25 | Scam-link / wallet phishing detection. |
| `pepelock` | Cypherpunk · 2025-09-25 | Token rug / risk analysis. |
| `playfair` | Breakout · 2025-04-14 | NFT + on-chain “certification / audit” style proofs. |
| `unruggable` / `unruggable-1` / `unruggable-2` / `unruggable-3` | Radar / Renaissance / Breakout / Cypherpunk | Wallet security line (MPC, CLI, hardware); multiple hackathon entries; accelerator C4. |

**Also surfaced (lower overlap with assurance manifests / SARIF pipelines):** e.g. `bangmaps`, `dexonic`, `xgen`, `predictionswap`, `posepilot`, `flynn's-arcade`, `salaamfi`, `flexanon`, `kayra`, `solana-tipjar`, `wavekiller`, `solana-dvpn`, `agreed`, `reflect-protocol`, `urani`, `spotlight-protocol`, `decal-payments-and-loyalty`, `blockmesh-network`, `devolt`, `dapp-wif-hat`, `supersize`, `tapedrive`, `fystack-1`, `arcana-markets`, `syncvote`, `xcrow` — keep in raw scan output for full context.

## Archive query (optional)

After `search/archives`, add short citations for conceptual framing — use **titles from the API** only.

**2026-04-12 `search/archives` (query: software supply chain audit)** — top titles: *How to Survive Supply-Chain Attacks* (OtterSec); *README: Use commit hashes for audits* (SPL issue); *Vyper Hack Timeline*; *How insecure are file system wallets* (Stack Exchange).

**Landscape caveat:** Do not claim “nobody has built X” without accelerator/portfolio-style project checks and clear “as far as the corpus shows” qualification; absence of hits is not proof of absence.

## Differentiation (ASST)

Commit-bound assurance manifests, merged SARIF, layered subagents, sandboxed CLI — not a single score or generic chat audit.
