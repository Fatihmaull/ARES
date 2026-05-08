# ARES Runbook

Operational runbook for local development, service recovery, and clean handoff between agents.

## 1) Repo Snapshot

- Monorepo package manager: `pnpm`
- Main applications:
  - `apps/web` (Next.js app + internal API routes)
  - `apps/chain-intake` (Hono webhook intake)
  - `apps/worker` (BullMQ worker + health server)
- Shared packages:
  - `packages/engine`
  - `packages/queue`
  - `packages/observability`

## 2) Standard Local Ports

- Web: `3000`
- Chain intake: `8787`
- Worker health: `9090`

## 3) First-Time Setup

From repo root:

```powershell
pnpm install --no-frozen-lockfile
```

Environment files to verify:

- `apps/web/.env.local`
- `apps/chain-intake/.env`
- `apps/worker/.env`

## 4) Start Services (No Double Execution)

Start each service once in a separate terminal.

### Web

From repo root:

```powershell
$env:PORT='3000'
pnpm --filter @asst/web dev
```

### Chain intake

From `apps/chain-intake`:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^=#]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}
pnpm dev
```

### Worker

From `apps/worker`:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^([^=#]+)=(.*)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
}
pnpm dev
```

## 5) Health Checks

- Web: open `http://localhost:3000`
- Chain intake: `GET http://localhost:8787/health`
- Worker: `GET http://localhost:9090/health`

If all are up, test core app flows from the web dashboard.

## 6) Common Failures and Recovery

### A) `EADDRINUSE` (port already in use)

Stop listeners before restart:

```powershell
foreach ($port in @(3000, 8787, 9090)) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
```

Then restart each service once.

### B) Next.js runtime chunk errors (`ENOENT` in `.next`, missing module chunk)

Symptoms include missing vendor chunks (for example around `zustand`) or missing generated server files.

Recovery:

```powershell
cd apps/web
pnpm clean
pnpm build
pnpm dev
```

Notes:

- `pnpm clean` in `apps/web` uses `scripts/clean-next.cjs` with retries for Windows file lock issues.
- Ensure no duplicate `next dev` process is running.

## 7) Build Commands

### Web production build

```powershell
cd apps/web
pnpm build
```

### Full workspace build

```powershell
cd .
pnpm build
```

## 8) Database and Intake Migrations

Chain-intake SQL migrations live in `apps/chain-intake/sql`.

Run migration script from `apps/chain-intake`:

```powershell
pnpm migrate
```

Recent migration files include:

- `009_targets.sql`
- `010_findings_status.sql`
- `011_notifications.sql`
- `012_user_preferences.sql`

## 9) Git Safety Rules for Agents

- Never run destructive git commands (`reset --hard`, force checkout) unless user explicitly asks.
- Avoid re-running long-lived services if already running on expected ports.
- Commit only when asked.
- Before commit, check:
  - `git status --short`
  - `git diff --stat`
  - `git log --oneline -n 6`

## 10) Handoff Checklist

Before ending a session:

1. Confirm service status (running or intentionally stopped).
2. Confirm no duplicate listeners on `3000`, `8787`, `9090`.
3. Summarize what changed (features, fixes, migrations).
4. Share exact commit hash if commit/push was done.
5. Note any warnings that are non-blocking (for example skill validation warnings in worker).
