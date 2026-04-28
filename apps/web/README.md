# @asst/web

Next.js 15 app that serves:

1. The public **marketing site** (home page, feature pages).
2. A **dashboard** showing assurance-run evidence and findings.
3. An **API surface** (`/api/*`) that talks to `@ares/engine`.

## Public-surface security model

The web app is intended to be reachable by untrusted users (with future wallet
auth + paid usage). Every API route therefore uses:

```ts
import { createPublicOrchestrator } from "@/lib/engine-factory";
```

`createPublicOrchestrator()` keeps the web surface read-oriented by default
(`ASST_ALLOW_WRITE=0` unless `ASST_WEB_ALLOW_WRITE=1` is explicitly set).

Do **not** instantiate `new Orchestrator()` directly from a web route.

## Layout

```
app/
├── layout.tsx               Root layout
├── page.tsx                 Landing page
├── dashboard/               Security dashboard pages
├── components/              Presentational components
└── api/
    ├── chat/route.ts        POST /api/chat — orchestrator.chat(prompt)
    ├── scan/route.ts        POST /api/scan — orchestrator.runFullScan()
    ├── agents/route.ts      GET  /api/agents — sub-agent metadata
    ├── findings/route.ts    GET  /api/findings — aggregated SARIF + scan
    ├── reports/route.ts     GET  /api/reports — report metadata
    └── console/stream/route.ts  SSE stream of recent agent activity
lib/
├── engine-factory.ts        createPublicOrchestrator() — THE only way
│                            API routes should build an Orchestrator.
└── data.ts                  Loaders for posture data from disk artifacts.
```

## Running locally

```bash
pnpm --filter @asst/web dev       # http://localhost:3000
pnpm --filter @asst/web build     # production bundle
pnpm --filter @asst/web start     # run compiled build
```

Environment (read from `.env.local` at repo root):

| Variable                  | Required | Purpose                                          |
| ------------------------- | -------- | ------------------------------------------------ |
| `GOOGLE_API_KEY`          | yes*     | default Gemini orchestrator model                |
| `OPENROUTER_API_KEY`      | when sub-agents use OpenRouter                   |
| `ASST_ORCHESTRATOR_MODEL` | no       | override default model, e.g. `ollama:llama3.1`   |
| `ASST_WEB_API_KEY`        | yes**    | required API key for protected `/api/*` routes   |
| `ASST_WEB_ALLOW_WRITE`    | no       | set to `1` ONLY on trusted private deployments   |
| `ASST_REPO_ROOT`          | no       | explicit repository root boundary for file access |
| `SOLANA_RPC_URL`          | no       | override default `https://api.devnet.solana.com` |

\* unless `ASST_ORCHESTRATOR_MODEL` points at a non-Google provider.  
\** in development only, routes allow missing key for local setup.

## Future: wallet-gated usage

The product direction is: a few free chats per wallet, then connect-and-pay.
The auth/payment surface will live in `app/api/auth/*` and a new
`lib/billing.ts`. Keep the engine agnostic — don't leak billing logic into
`@ares/engine`.
