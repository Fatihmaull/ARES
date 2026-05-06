# Chain intake (Helius → PostgreSQL → Assurance Run)

Small **HTTPS webhook receiver** plus **idempotent PostgreSQL storage**, **Helius Enhanced Transactions backfill**, and a **deterministic JSON export** for [`write-run-manifest.ts --chain-evidence`](../../deepagentsjs/examples/assurance-run/write-run-manifest.ts).

Helius may **retry deliveries**; duplicates are dropped with `ON CONFLICT (signature) DO NOTHING` (same signature always identifies one on-chain transaction).

## Docs (Helius)

- [Webhooks overview](https://www.helius.dev/docs/webhooks) — retries & duplicate delivery
- [Enhanced Transactions — transaction history](https://www.helius.dev/docs/enhanced-transactions/transaction-history) — backfill pagination (`before-signature`, `limit`)
- [Enhanced Transactions — parse transactions](https://www.helius.dev/docs/enhanced-transactions/parse-transactions) — batch parse by signature

## What it does

1. **Receives** Helius webhook deliveries (JSON arrays of enhanced transactions) and persists them idempotently to `helius_parsed_tx`.
2. **Classifies** each tx through a pure rule engine (`src/triggers.ts`) and persists anomaly findings to `chain_triggers`. Rule coverage:

   | Rule                         | Fires on                                                                      | Default severity |
   | ---------------------------- | ----------------------------------------------------------------------------- | ---------------- |
   | `program_upgrade`            | Helius `type === UPGRADE_PROGRAM_INSTRUCTION` or BPF-Loader `Upgrade` ix     | high             |
   | `upgrade_authority_change`   | BPF-Loader `SetAuthority`                                                     | critical         |
   | `mint_authority_change`      | SPL-Token `SetAuthority` w/ authority type 0 (Mint)                           | high             |
   | `freeze_authority_change`    | SPL-Token `SetAuthority` w/ authority type 1 (Freeze)                         | high             |
   | `large_native_transfer`     | `nativeTransfers[].amount` ≥ `CHAIN_LARGE_NATIVE_LAMPORTS` (default 1 000 SOL)| medium           |
   | `large_token_transfer`      | `tokenTransfers[].tokenAmount` ≥ `CHAIN_LARGE_TOKEN_UI_AMOUNT` (default 1e6)  | medium           |

   If `WATCH_ADDRESS` appears anywhere in the tx (fee payer, transfer, or ix account), every trigger's severity is bumped one level and the `evidence.watched` flag is set.

3. **Exports** both the raw transactions and the derived triggers into a deterministic `asst_chain_evidence_v2` bundle that the Assurance Run manifest writer hashes + summarizes into `chain_intelligence.{trigger_counts, trigger_max_severity, trigger_kinds}`.

## Setup

1. Create a database and apply the schemas:

   ```bash
   psql "$DATABASE_URL" -f sql/001_init.sql
   psql "$DATABASE_URL" -f sql/002_triggers.sql
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL`, `HELIUS_API_KEY`, `WATCH_ADDRESS`.

3. Install and run the HTTP server (Fly.io, Railway, or local):

   ```bash
   pnpm install
   pnpm start
   ```

4. In the [Helius dashboard](https://dashboard.helius.dev/), create a webhook whose **URL** points at your deployed service, e.g.  
   `https://<host>/webhooks/helius`  
   Optionally append `?secret=<WEBHOOK_SHARED_SECRET>` and set the same value in `.env` so only requests with that secret are accepted.

5. **Backfill** after deploy (or on a schedule) so you recover history missed during downtime:

   ```bash
   pnpm run backfill
   ```

   Uses `GET /v0/addresses/{WATCH_ADDRESS}/transactions` with pagination (see Helius docs above). Cursor metadata is stored in `pipeline_backfill_cursor` for observability; extend the script if you need strict resume-from-cursor behavior.

6. **Export** merged parsed JSON for Assurance Run:

   ```bash
   pnpm run export-evidence -- ../../assurance/chain-evidence.json
   cd ../../deepagentsjs && pnpm exec tsx examples/assurance-run/write-run-manifest.ts --cwd .. --chain-evidence ../assurance/chain-evidence.json
   ```

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `HELIUS_API_KEY` | Backfill API calls |
| `WATCH_ADDRESS` | Same base address as in the Helius webhook (program, wallet, etc.) |
| `PORT` | HTTP port (default `8787`) |
| `WEBHOOK_SHARED_SECRET` | Required in production; require `Authorization: Bearer …` or `?secret=` |
| `BACKFILL_MAX_PAGES` | Optional safety cap on pagination loops |
| `CHAIN_NETWORK` | Optional string in exported evidence (default `solana-mainnet`) |
| `CHAIN_LARGE_NATIVE_LAMPORTS` | Threshold for `large_native_transfer` (default `1_000_000_000_000` = 1 000 SOL) |
| `CHAIN_LARGE_TOKEN_UI_AMOUNT` | Threshold for `large_token_transfer` in UI tokens (default `1_000_000`) |

## Docker

```bash
docker build -t chain-intake .
docker run --env-file .env -p 8787:8787 chain-intake
```

## Idempotency

- **helius_parsed_tx primary key:** Solana transaction `signature` (unique chain-wide).
- **chain_triggers primary key:** `(signature, kind)` — the same tx classified again produces the same (signature, kind) row, so re-classifying on retry / reprocessing is a no-op.
- **Slot** stored for ordering and debugging; duplicates always share the same signature, so retries do not create duplicate rows.

## Tests

```bash
pnpm --filter @asst/chain-intake test
```

The trigger classifier is pure (no DB, no network) and tested against synthetic Helius-shaped fixtures for each rule plus negatives (benign transfers, missing signatures). See `src/__tests__/triggers.test.ts`.
