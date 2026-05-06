# Load test — `/api/chat` (§10 P2 gate)

Validates that IP middleware + chat route stay responsive under concurrent POSTs.

## Prerequisites

- Web app running (`pnpm --filter @asst/web dev` or production server).
- For **stress without quota/billing**, set `ASST_WEB_API_KEY` in the environment and pass the same key in the script (operator path).

## Run

From repo root:

```bash
cd apps/web
node scripts/load-test-chat.mjs
```

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | Origin of the Next app |
| `CONCURRENCY` | `5` | Parallel busy loops |
| `DURATION_SEC` | `15` | How long each worker runs |
| `ASST_WEB_API_KEY` | unset | If set, sent as `x-api-key` (operator ingress) |

Example:

```bash
CONCURRENCY=10 DURATION_SEC=30 BASE_URL=http://127.0.0.1:3000 node scripts/load-test-chat.mjs
```

Exit code `1` if any request fails (non-2xx). Review JSON output for `failed`, `sampleErrors`, and `latencyMs.p95`.

## Gate interpretation

- Expect **429** when IP or chat route rate limits trigger — not necessarily failure for capacity planning; tune `CONCURRENCY` / `DURATION_SEC` or test with operator key for infrastructure-only limits.
- Engine failures (5xx) indicate upstream LLM/config issues, not rate-limit success.

## npm script

```bash
pnpm --filter @asst/web run load-test:chat
```
