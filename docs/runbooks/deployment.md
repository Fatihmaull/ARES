# Deployment Runbook

This runbook covers the **managed-PaaS** path agreed in
[ares-web-native-development-blueprint-consolidated.md](../design/ares-web-native-development-blueprint-consolidated.md).

## Topology

| Service | Host | Build | Notes |
|---------|------|-------|-------|
| `apps/web` | Vercel | `next build` | Static + edge, serves UI and API |
| `apps/worker` | Fly.io (`ares-worker`) | `apps/worker/Dockerfile` | Long-running BullMQ consumer |
| `apps/chain-intake` | Fly.io (`ares-chain-intake`) | `apps/chain-intake/Dockerfile` | Helius webhook receiver |
| Postgres | Neon | n/a | Production + staging projects |
| Redis | Upstash | n/a | REST URL for nonces/ratelimit, TLS URL for BullMQ |
| Object storage | Cloudflare R2 | n/a | One bucket per env |
| Errors | Sentry | n/a | One project, three DSNs (web/worker/intake) |

## Required GitHub Actions secrets

- `FLY_API_TOKEN` — fly deploy auth (worker + chain-intake).
- `DATABASE_URL` — production Neon connection string.
- `DATABASE_URL_STAGING` — staging Neon connection string.
- `VERCEL_TOKEN` — only if you wire a Vercel deploy workflow; the default
  Vercel Git integration covers `apps/web` automatically.

## Required Vercel project env (apps/web)

See [`apps/web/.env.example`](../../apps/web/.env.example) — every key listed
there must be set in Vercel for the production environment, plus:

- `CRON_SECRET` for the hourly `/api/admin/reconcile-payai` trigger.

## First-time provision

1. Create Neon prod + staging projects; copy connection strings into GitHub Actions secrets and Vercel env.
2. Create Upstash Redis (Standard plan with TCP URL); copy `ASST_QUEUE_REDIS_URL` into Fly worker secrets and Vercel env.
3. Create the same Upstash Redis REST credentials and put them into Vercel env (for nonces / ratelimits).
4. Create R2 bucket; copy access key / secret / endpoint / bucket into both Vercel and Fly worker secrets.
5. Create Sentry project; add 3 DSNs (web, worker, intake) — store on each platform.
6. Create the Fly apps:
   ```
   flyctl apps create ares-worker
   flyctl apps create ares-chain-intake
   flyctl secrets set --app ares-worker DATABASE_URL=... ASST_QUEUE_REDIS_URL=... GOOGLE_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... ASST_OBJECT_STORE_ENDPOINT=... ASST_OBJECT_STORE_REGION=auto ASST_OBJECT_STORE_BUCKET=... ASST_OBJECT_STORE_ACCESS_KEY_ID=... ASST_OBJECT_STORE_SECRET_ACCESS_KEY=... SENTRY_DSN=...
   flyctl secrets set --app ares-chain-intake DATABASE_URL=... HELIUS_API_KEY=... WEBHOOK_SHARED_SECRET=... SENTRY_DSN=...
   ```
7. Run migrations once via the `Database Migrations` workflow with `DATABASE_URL`.
8. Push to `improved-ares`/`main` — the deploy workflows roll out worker and chain-intake.

## Pre-deploy checklist

- [ ] Migrations from latest commit applied (run `Database Migrations` workflow).
- [ ] PayAI webhook URL in PayAI dashboard set to `https://<prod-host>/api/billing/webhooks/payai` with the matching signing secret.
- [ ] Helius webhook URL set to `https://ares-chain-intake.fly.dev/webhooks/helius` with `WEBHOOK_SHARED_SECRET`.
- [ ] Vercel cron `/api/admin/reconcile-payai` configured (already in `apps/web/vercel.json`).
- [ ] Sentry release tagged on each deploy via the workflow (TODO: optional integration).

## Smoke test (paid pilot)

Follow [paid-pilot.md](paid-pilot.md).
