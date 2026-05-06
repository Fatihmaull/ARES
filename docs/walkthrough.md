# ASST Web-First Walkthrough

This walkthrough describes the web-first flow for ASST after CLI removal.

## 1. Start services

1. Install dependencies: `pnpm install`
2. Start web app: `pnpm --filter @asst/web dev`
3. Optional companion services:
   - MCP server: `pnpm --filter @asst/mcp-server dev`
   - Chain intake: `pnpm --filter @asst/chain-intake dev`

## 2. Exercise the dashboard

1. Open `http://localhost:3000`
2. Navigate to `/dashboard/overview`
3. Verify API-backed panels load:
   - posture
   - findings
   - reports
   - agent metadata

## 3. Exercise console + APIs

1. Open `/dashboard/console`
2. Send a command and verify `/api/chat` response appears in stream
3. Trigger scan and verify `/api/scan` returns queued status
4. Confirm deterministic response envelopes (`ok`, `requestId`, `data`)

## 4. Production hardening checks

1. Set `ASST_WEB_API_KEY` and confirm protected routes require the key
2. Validate report download path controls (`/api/reports/download?file=...`)
3. Confirm route-level rate limiting behavior on hot endpoints
